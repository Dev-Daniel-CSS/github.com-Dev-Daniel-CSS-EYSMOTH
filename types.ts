
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export enum UserRole {
  SELLER = 'seller',
  BUYER = 'buyer',
  UNSET = 'unset'
}

export enum PaymentMethod {
  COD = 'Cash on Delivery',
  GCASH = 'GCash (E-Wallet)'
}

export interface UserProfile {
  email: string;
  phone: string;
  address: string;
  zipCode: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  type: 'text' | 'image' | 'listing';
  imageUrl?: string;
  itemData?: ThriftItem;
}

export interface ThriftItem {
  id: string;
  title: string;
  description: string;
  price: string; // e.g., "$45.00"
  category: string;
  imageUrl: string;
  status: 'draft' | 'published';
}

export interface CartItem extends ThriftItem {
  cartId: string;
  selected: boolean;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: string;
  paymentMethod: PaymentMethod;
  status: 'pending' | 'shipping' | 'delivered';
  timestamp: number;
}
