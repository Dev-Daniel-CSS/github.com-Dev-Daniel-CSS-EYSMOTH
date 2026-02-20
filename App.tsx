
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, MessageRole, ThriftItem, UserRole, UserProfile, CartItem, PaymentMethod, Order } from './types';
import { generateAIResponse, detectImageIntent } from './services/geminiService';
import { storage } from './services/geminiService';
import MessageItem from './components/MessageItem';
import ChatInput from './components/ChatInput';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inventory, setInventory] = useState<ThriftItem[]>([]);
  const [editingItem, setEditingItem] = useState<ThriftItem | null>(null);
  const [role, setRole] = useState<UserRole>(UserRole.UNSET);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    email: '', phone: '', address: '', zipCode: '', name: ''
  });
  const [isProfileSubmitted, setIsProfileSubmitted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  
  // Cart & Orders
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.COD);
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categories = ['All', 'T-shirt', 'Pants', 'Shorts', 'Outerwear', 'Dresses', 'Vintage'];

  // Initialize DB & Session
  useEffect(() => {
    const savedProfile = storage.getProfile();
    if (savedProfile) {
      setUserProfile(savedProfile);
      setIsProfileSubmitted(true);
    }

    const savedInventory = storage.getInventory();
    if (savedInventory.length === 0) {
      // Seed initial data if empty
      const initial: ThriftItem[] = [
        { id: '1', title: "Vintage Silk Slip Dress", description: "90s minimalist aesthetic, emerald green, size S.", price: "$45.00", category: "Dresses", imageUrl: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop", status: 'published' },
        { id: '2', title: "Leather Bomber Jacket", description: "Distressed brown leather, oversized fit, unisex.", price: "$85.00", category: "Outerwear", imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop", status: 'published' }
      ];
      storage.saveInventory(initial);
      setInventory(initial);
    } else {
      setInventory(savedInventory);
    }
    
    setOrderHistory(storage.getOrders());
  }, []);

  // Sync state to storage
  useEffect(() => {
    if (isProfileSubmitted) storage.saveProfile(userProfile);
  }, [userProfile, isProfileSubmitted]);

  useEffect(() => {
    if (inventory.length > 0) storage.saveInventory(inventory);
  }, [inventory]);

  const handleSendMessage = async (input: string, forceImage: boolean) => {
    const isImage = forceImage || detectImageIntent(input);
    const userMessage: ChatMessage = { id: Date.now().toString(), role: MessageRole.USER, content: input, timestamp: Date.now(), type: 'text' };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const apiHistory = messages.slice(-6).map(m => ({ role: m.role === MessageRole.USER ? 'user' : 'model', parts: [{ text: m.content }] }));
      const response = await generateAIResponse(input, apiHistory, isImage, 'seller');
      const botMessage: ChatMessage = { id: Date.now().toString(), role: MessageRole.ASSISTANT, content: response.text || (isImage ? "Image generated." : ""), timestamp: Date.now(), type: isImage ? 'image' : 'text', imageUrl: response.imageUrl };
      setMessages(prev => [...prev, botMessage]);

      if (response.extractedListing) {
        const newItem: ThriftItem = {
          id: Date.now().toString(),
          title: response.extractedListing.title || "New Item",
          description: response.extractedListing.description || "",
          price: response.extractedListing.price || "$0.00",
          category: response.extractedListing.category || "Uncategorized",
          imageUrl: response.imageUrl || "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&auto=format&fit=crop",
          status: 'draft'
        };
        setInventory(prev => [newItem, ...prev]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: 'err', role: MessageRole.ASSISTANT, content: "Request error. Please try again.", timestamp: Date.now(), type: 'text' }]);
    } finally { setIsLoading(false); }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out? Your session will be cleared.")) {
      storage.clearAll();
      window.location.reload();
    }
  };

  const calculateTotal = () => {
    const total = cart.filter(i => i.selected).reduce((acc, item) => acc + parseFloat(item.price.replace('$', '')), 0);
    return `$${total.toFixed(2)}`;
  };

  const placeOrder = () => {
    setIsOrderPlaced(true);
    const selectedItems = cart.filter(i => i.selected);
    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      items: selectedItems,
      total: calculateTotal(),
      paymentMethod,
      status: 'pending',
      timestamp: Date.now()
    };

    setTimeout(() => {
      storage.addOrder(newOrder);
      setOrderHistory(storage.getOrders());
      setCart(prev => prev.filter(i => !i.selected));
      setIsOrderPlaced(false);
      setIsCheckoutOpen(false);
      alert("Order success! Check your email for shipping tracking.");
    }, 1500);
  };

  const filteredItems = inventory
    .filter(i => i.status === 'published')
    .filter(i => activeCategory === 'All' || i.category.toLowerCase().includes(activeCategory.toLowerCase()))
    .filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()) || i.description.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!isProfileSubmitted) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#fdfcfb] p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10 border border-slate-50">
          <div className="text-center mb-8">
            <h1 className="serif-font text-5xl font-bold mb-2">THRIFTMARKET</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">by: Dev.Daniel</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setIsProfileSubmitted(true); }} className="space-y-4">
            <input required type="text" placeholder="Full Name" value={userProfile.name} onChange={e => setUserProfile({...userProfile, name: e.target.value})} className="w-full bg-slate-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black transition-all" />
            <input required type="email" placeholder="Email" value={userProfile.email} onChange={e => setUserProfile({...userProfile, email: e.target.value})} className="w-full bg-slate-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black transition-all" />
            <input required type="tel" placeholder="Phone" value={userProfile.phone} onChange={e => setUserProfile({...userProfile, phone: e.target.value})} className="w-full bg-slate-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black transition-all" />
            <input required type="text" placeholder="Shipping Address" value={userProfile.address} onChange={e => setUserProfile({...userProfile, address: e.target.value})} className="w-full bg-slate-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black transition-all" />
            <input required type="text" placeholder="Zip Code" value={userProfile.zipCode} onChange={e => setUserProfile({...userProfile, zipCode: e.target.value})} className="w-full bg-slate-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black transition-all" />
            <button type="submit" className="w-full bg-black text-white font-bold py-4 rounded-xl hover:opacity-90 active:scale-95 transition-all mt-4 uppercase tracking-widest text-xs">Register & Login</button>
          </form>
        </div>
      </div>
    );
  }

  if (role === UserRole.UNSET) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#fdfcfb] p-6">
        <div className="w-full max-w-4xl space-y-12 text-center">
          <div className="space-y-2">
            <h1 className="serif-font text-6xl font-bold tracking-tight">THRIFTMARKET</h1>
            <p className="text-slate-400 uppercase tracking-[0.4em] font-semibold text-[10px]">by: Dev.Daniel • User: {userProfile.name}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <button onClick={() => setRole(UserRole.SELLER)} className="group rounded-3xl bg-black p-12 text-white shadow-2xl transition-all hover:scale-[1.02]">
              <h2 className="serif-font text-3xl font-bold mb-4">Seller Dashboard</h2>
              <p className="text-slate-400 text-sm mb-6">List items and manage inventory.</p>
              <span className="font-bold text-[10px] border-b border-white/20 pb-1 uppercase tracking-widest">Enter Studio</span>
            </button>
            <button onClick={() => setRole(UserRole.BUYER)} className="group rounded-3xl bg-white p-12 text-black shadow-xl border border-slate-100 transition-all hover:scale-[1.02]">
              <h2 className="serif-font text-3xl font-bold mb-4">Buyer Market</h2>
              <p className="text-slate-500 text-sm mb-6">Shop unique curated drops.</p>
              <span className="font-bold text-[10px] border-b border-black/10 pb-1 uppercase tracking-widest">Enter Shop</span>
            </button>
          </div>
          <button onClick={handleLogout} className="text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-red-500">Log Out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden flex-col md:flex-row">
      {/* Dynamic Content based on Role */}
      {role === UserRole.BUYER ? (
        <div className="flex flex-col flex-1 bg-[#f8f7f5] overflow-hidden">
          <header className="bg-white border-b px-6 py-4 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-10">
            <div className="flex flex-col cursor-pointer" onClick={() => setRole(UserRole.UNSET)}>
              <h1 className="serif-font text-3xl font-black leading-none">THRIFTMARKET</h1>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">by: Dev.Daniel</span>
            </div>
            <div className="flex-1 max-w-xl relative w-full">
              <input type="text" placeholder="Search for unique pieces..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-100 rounded-2xl px-12 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-black transition-all" />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-3 mr-2">
                <button 
                  onClick={() => setRole(UserRole.UNSET)} 
                  className="text-[10px] font-bold text-slate-400 uppercase hover:text-black transition-colors py-1"
                >
                  Exit Market
                </button>
                <div className="h-4 w-[1px] bg-slate-200"></div>
                <button 
                  onClick={handleLogout} 
                  className="text-[10px] font-bold text-red-500 uppercase hover:text-red-600 transition-colors py-1"
                >
                  Log Out
                </button>
              </div>
              <button onClick={() => setIsCartOpen(true)} className="relative p-2.5 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors border border-slate-100">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-black text-white text-[8px] font-bold h-4 w-4 rounded-full flex items-center justify-center animate-bounce">{cart.length}</span>}
              </button>
            </div>
          </header>

          <div className="bg-white px-6 py-3 border-b flex gap-3 overflow-x-auto no-scrollbar">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${activeCategory === cat ? 'bg-black text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{cat}</button>
            ))}
          </div>

          <main className="flex-1 overflow-y-auto p-6 md:p-10">
            <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:gap-8">
              {filteredItems.map(item => (
                <div key={item.id} className="group bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all border border-slate-100 flex flex-col cursor-pointer">
                  <div className="aspect-[3/4] overflow-hidden relative">
                    <img src={item.imageUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt={item.title} />
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <span className="text-[9px] font-black text-slate-300 uppercase mb-1">{item.category}</span>
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-1 mb-3">{item.title}</h3>
                    <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-xl font-black">{item.price}</span>
                      <button onClick={(e) => { e.stopPropagation(); setCart(p => [...p, {...item, cartId: Math.random().toString(), selected: true}]); }} className="bg-black text-white text-[9px] font-bold px-4 py-2 rounded-xl uppercase hover:bg-slate-800">Add</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>

          {isCartOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-end bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white w-full max-w-md h-full rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-6 border-b flex justify-between items-center">
                  <h2 className="serif-font text-2xl font-bold">Shopping Bag</h2>
                  <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {cart.map(item => (
                    <div key={item.cartId} className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl">
                      <input type="checkbox" checked={item.selected} onChange={() => setCart(c => c.map(i => i.cartId === item.cartId ? {...i, selected: !i.selected} : i))} className="h-5 w-5 rounded-md text-black focus:ring-black" />
                      <div className="h-16 w-12 bg-white rounded overflow-hidden shadow-sm"><img src={item.imageUrl} className="w-full h-full object-cover" alt="" /></div>
                      <div className="flex-1"><h4 className="font-bold text-xs">{item.title}</h4><p className="text-xs font-black">{item.price}</p></div>
                      <button onClick={() => setCart(c => c.filter(i => i.cartId !== item.cartId))} className="text-slate-300 hover:text-red-500 transition-colors">✕</button>
                    </div>
                  ))}
                  {cart.length === 0 && <p className="text-center text-slate-400 text-xs py-10 font-bold uppercase tracking-widest">Bag is empty</p>}
                </div>
                {cart.length > 0 && (
                  <div className="p-6 border-t bg-white">
                    <div className="flex justify-between items-center mb-6"><span className="text-xs font-bold uppercase text-slate-400 tracking-widest">Total</span><span className="text-2xl font-black">{calculateTotal()}</span></div>
                    <button onClick={() => { setIsCheckoutOpen(true); setIsCartOpen(false); }} className="w-full bg-black text-white font-bold py-4 rounded-2xl uppercase tracking-widest text-xs hover:opacity-90 active:scale-95 transition-all">Checkout</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {isCheckoutOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
              <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-8 border-b flex justify-between items-center">
                  <h2 className="serif-font text-3xl font-bold">Order Summary</h2>
                  <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <p className="font-bold text-sm mb-1">{userProfile.name}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{userProfile.address}, {userProfile.zipCode}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setPaymentMethod(PaymentMethod.COD)} className={`p-4 rounded-2xl border-2 text-left transition-all ${paymentMethod === PaymentMethod.COD ? 'border-black bg-black text-white' : 'border-slate-100 hover:border-slate-200'}`}><span className="text-xs font-bold block uppercase tracking-widest">COD</span><span className="text-[10px] opacity-50">Cash on Delivery</span></button>
                    <button onClick={() => setPaymentMethod(PaymentMethod.GCASH)} className={`p-4 rounded-2xl border-2 text-left transition-all ${paymentMethod === PaymentMethod.GCASH ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-100 hover:border-slate-200'}`}><span className="text-xs font-bold block uppercase tracking-widest">GCash</span><span className="text-[10px] opacity-50">E-Wallet Transfer</span></button>
                  </div>
                </div>
                <div className="p-8 border-t bg-slate-50/30">
                  <div className="flex justify-between items-end mb-6"><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Grand Total</p><p className="text-3xl font-black">{calculateTotal()}</p></div></div>
                  <button onClick={placeOrder} disabled={isOrderPlaced} className="w-full h-16 bg-black text-white font-bold rounded-2xl active:scale-95 uppercase tracking-widest text-xs disabled:opacity-50">{isOrderPlaced ? 'Processing...' : 'Place Order'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <aside className="w-full md:w-[400px] border-r border-slate-100 flex flex-col bg-white">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-6">
                <div className="flex flex-col">
                  <h1 className="serif-font text-2xl font-bold">Seller Studio</h1>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">THRIFTMARKET by: Dev.Daniel</span>
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-black text-white rounded-full flex items-center px-4 py-2 gap-2 shadow-lg shadow-black/10 hover:opacity-90 active:scale-95 transition-all">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Add Item</span>
                </button>
              </div>
              <div className="flex justify-between">
                <button className="text-xs font-bold border-b-2 border-black pb-1 uppercase tracking-widest">My Listings</button>
                <div className="flex items-center gap-3">
                  <button onClick={() => setRole(UserRole.UNSET)} className="text-[10px] font-bold text-slate-400 uppercase hover:text-black transition-colors">Exit Shop</button>
                  <div className="h-3 w-[1px] bg-slate-200"></div>
                  <button onClick={handleLogout} className="text-[10px] font-bold text-red-400 uppercase hover:text-red-600 transition-colors">Logout</button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
              {inventory.map(item => (
                <div key={item.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex gap-4 hover:shadow-md transition-all">
                  <div className="h-16 w-12 bg-slate-100 rounded overflow-hidden shrink-0"><img src={item.imageUrl} className="w-full h-full object-cover" alt="" /></div>
                  <div className="flex-1 min-w-0"><h4 className="text-sm font-bold truncate">{item.title}</h4><p className="text-xs font-black">{item.price}</p></div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => { storage.deleteInventoryItem(item.id); setInventory(storage.getInventory()); }} className="text-[9px] text-red-500 font-bold uppercase tracking-widest hover:underline">Delete</button>
                    <button onClick={() => setEditingItem(item)} className="text-[9px] text-blue-500 font-bold uppercase tracking-widest hover:underline">Edit</button>
                  </div>
                </div>
              ))}
              {inventory.length === 0 && <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] py-10">No listings yet</p>}
            </div>
          </aside>
          <main className="flex-1 flex flex-col bg-white">
            <header className="px-8 py-6 flex items-center justify-between border-b border-slate-50">
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-black animate-pulse"></div>
                <span className="text-sm font-bold uppercase tracking-widest">Assistant</span>
              </div>
              <span className="text-[10px] font-bold uppercase text-slate-300 tracking-[0.2em]">Active: {userProfile.name}</span>
            </header>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8"><div className="mx-auto max-w-3xl space-y-10 pb-10">{messages.map((msg) => (<MessageItem key={msg.id} message={msg} />))}{isLoading && <div className="p-4 bg-slate-50 rounded-xl w-fit animate-pulse text-[10px] font-bold text-slate-400 uppercase tracking-widest">Processing request...</div>}</div></div>
            <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
          </main>
        </>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="serif-font text-2xl font-bold">Update Listing</h2>
            <div className="space-y-3">
              <input type="text" value={editingItem.title} onChange={e => setEditingItem({...editingItem, title: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-black transition-all" placeholder="Title" />
              <input type="text" value={editingItem.price} onChange={e => setEditingItem({...editingItem, price: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-black transition-all" placeholder="Price (e.g. $45.00)" />
              <textarea value={editingItem.description} onChange={e => setEditingItem({...editingItem, description: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-black transition-all" rows={3} placeholder="Detailed description..." />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { storage.updateInventoryItem(editingItem); setEditingItem(null); setInventory(storage.getInventory()); }} className="flex-1 bg-black text-white py-3.5 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:opacity-90 active:scale-95 transition-all">Save Changes</button>
              <button onClick={() => setEditingItem(null)} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-slate-200 active:scale-95 transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const newItem: ThriftItem = { id: Date.now().toString(), title: "New Listing", description: "Fresh upload via Seller Studio.", price: "$0.00", category: "Vintage", imageUrl: ev.target?.result as string, status: 'published' };
          storage.addInventoryItem(newItem);
          setInventory(storage.getInventory());
        };
        reader.readAsDataURL(file);
      }} />
    </div>
  );
};

export default App;
