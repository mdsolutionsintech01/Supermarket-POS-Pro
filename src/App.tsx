/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  ShoppingCart, 
  User, 
  LogOut, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  Printer, 
  Package, 
  BarChart3,
  X,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Product {
  id: string;
  barcode: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  vat_rate: number;
}

interface CartItem extends Product {
  quantity: number;
}

interface User {
  id: string;
  username: string;
  role: string;
  name: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [lastSale, setLastSale] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'reports'>('pos');
  const [dailyReport, setDailyReport] = useState<any>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchProducts();
      fetchDailyReport();
    }
  }, [user]);

  const fetchProducts = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data);
  };

  const fetchDailyReport = async () => {
    const res = await fetch('/api/reports/daily');
    const data = await res.json();
    setDailyReport(data);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData),
    });
    if (res.ok) {
      const userData = await res.json();
      setUser(userData);
    } else {
      alert('Invalid credentials');
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert('Out of stock!');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } 
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setSearchQuery('');
    barcodeInputRef.current?.focus();
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        if (newQty > item.stock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = cart.reduce((sum, item) => sum + (item.price * item.quantity * (item.vat_rate / 100)), 0);
  const total = subtotal + tax;

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.barcode === searchQuery);
    if (product) {
      addToCart(product);
    } else {
      // Try fuzzy search if barcode not exact
      const fuzzy = products.find(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
      if (fuzzy) addToCart(fuzzy);
    }
    setSearchQuery('');
  };

  const processSale = async () => {
    const paid = parseFloat(amountPaid) || total;
    if (paid < total) {
      alert('Insufficient payment');
      return;
    }

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart,
        payment: {
          method: paymentMethod,
          amountPaid: paid,
          discount: 0
        },
        userId: user?.id
      }),
    });

    if (res.ok) {
      const saleData = await res.json();
      setLastSale({
        ...saleData,
        items: [...cart],
        paymentMethod,
        amountPaid: paid,
        change: paid - total,
        date: new Date().toLocaleString()
      });
      setCart([]);
      setIsPaymentModalOpen(false);
      setAmountPaid('');
      fetchProducts();
      fetchDailyReport();
      
      // Auto-print simulation
      setTimeout(() => {
        window.print();
      }, 500);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
              <ShoppingCart className="text-emerald-500 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white">Supermarket POS</h1>
            <p className="text-zinc-400 text-sm">Sign in to your register</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Username</label>
              <input 
                type="text" 
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                placeholder="Enter username"
                value={loginData.username}
                onChange={e => setLoginData(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Password</label>
              <input 
                type="password" 
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                placeholder="••••••••"
                value={loginData.password}
                onChange={e => setLoginData(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
            >
              Open Register
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-zinc-800 text-center">
            <p className="text-zinc-500 text-xs">Demo: admin / admin123 or cashier / cashier123</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between no-print">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-emerald-500 w-6 h-6" />
            <span className="font-bold text-xl tracking-tight">SuperPOS</span>
          </div>
          
          <nav className="flex items-center gap-1">
            <button 
              onClick={() => setActiveTab('pos')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === 'pos' ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              Register
            </button>
            <button 
              onClick={() => setActiveTab('inventory')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === 'inventory' ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              Inventory
            </button>
            <button 
              onClick={() => setActiveTab('reports')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === 'reports' ? "bg-emerald-500/10 text-emerald-500" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              Reports
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-white">{user.name}</p>
            <p className="text-xs text-zinc-500 capitalize">{user.role}</p>
          </div>
          <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700">
            <User className="w-5 h-5 text-zinc-400" />
          </div>
          <button 
            onClick={() => setUser(null)}
            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="p-6 no-print">
        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)]">
            {/* Left: Product Selection */}
            <div className="lg:col-span-8 flex flex-col gap-6 overflow-hidden">
              {/* Search Bar */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl">
                <form onSubmit={handleBarcodeSubmit} className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
                  <input 
                    ref={barcodeInputRef}
                    type="text"
                    autoFocus
                    placeholder="Scan barcode or search products..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-12 pr-4 py-4 text-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </form>
              </div>

              {/* Product Grid */}
              <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pr-2 custom-scrollbar">
                {products
                  .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery))
                  .map(product => (
                    <motion.button
                      key={product.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => addToCart(product)}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-left flex flex-col gap-3 hover:border-emerald-500/50 transition-all group relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                          {product.category}
                        </span>
                        {product.stock < 10 && (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-white line-clamp-1">{product.name}</h3>
                        <p className="text-xs text-zinc-500 font-mono">{product.barcode}</p>
                      </div>
                      <div className="mt-auto flex justify-between items-end">
                        <span className="text-xl font-black text-white">R {product.price.toFixed(2)}</span>
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded",
                          product.stock > 0 ? "bg-zinc-800 text-zinc-400" : "bg-red-500/10 text-red-500"
                        )}>
                          Stock: {product.stock}
                        </span>
                      </div>
                      <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </motion.button>
                  ))}
              </div>
            </div>

            {/* Right: Cart & Checkout */}
            <div className="lg:col-span-4 flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-500" />
                  <h2 className="font-bold text-white">Current Order</h2>
                </div>
                <span className="bg-zinc-800 text-zinc-400 text-xs font-bold px-2 py-1 rounded-full">
                  {cart.length} Items
                </span>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4 opacity-50">
                      <ShoppingCart className="w-16 h-16" />
                      <p className="font-medium">Cart is empty</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3 flex items-center gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{item.name}</h4>
                          <p className="text-xs text-zinc-500">R {item.price.toFixed(2)} / unit</p>
                        </div>
                        
                        <div className="flex items-center gap-2 bg-zinc-900 rounded-lg p-1 border border-zinc-700">
                          <button 
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1 hover:bg-zinc-800 rounded transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 hover:bg-zinc-800 rounded transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right min-w-[70px]">
                          <p className="text-sm font-bold text-white">R {(item.price * item.quantity).toFixed(2)}</p>
                        </div>

                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>

              {/* Summary */}
              <div className="p-6 bg-zinc-950/50 border-t border-zinc-800 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-zinc-400">
                    <span>Subtotal</span>
                    <span>R {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-400">
                    <span>VAT (15%)</span>
                    <span>R {tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-zinc-800">
                    <span className="text-lg font-bold text-white">Total</span>
                    <span className="text-2xl font-black text-emerald-500">R {total.toFixed(2)}</span>
                  </div>
                </div>

                <button 
                  disabled={cart.length === 0}
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-5 h-5" />
                  Checkout
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="w-6 h-6 text-emerald-500" />
                <h2 className="text-xl font-bold text-white">Inventory Management</h2>
              </div>
              <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all">
                Add Product
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-950/50 text-zinc-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Product</th>
                    <th className="px-6 py-4 font-semibold">Barcode</th>
                    <th className="px-6 py-4 font-semibold">Category</th>
                    <th className="px-6 py-4 font-semibold">Price</th>
                    <th className="px-6 py-4 font-semibold">Stock</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {products.map(product => (
                    <tr key={product.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{product.name}</td>
                      <td className="px-6 py-4 text-zinc-500 font-mono text-sm">{product.barcode}</td>
                      <td className="px-6 py-4">
                        <span className="bg-zinc-800 text-zinc-400 px-2 py-1 rounded text-xs">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-white">R {product.price.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "font-bold",
                          product.stock < 10 ? "text-amber-500" : "text-zinc-300"
                        )}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {product.stock > 0 ? (
                          <span className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> In Stock
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-red-500 text-xs font-bold">
                            <X className="w-3.5 h-3.5" /> Out of Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <BarChart3 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Today</span>
                </div>
                <h3 className="text-zinc-400 text-sm font-medium mb-1">Total Revenue</h3>
                <p className="text-3xl font-black text-white">R {dailyReport?.total_revenue?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <ShoppingCart className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
                <h3 className="text-zinc-400 text-sm font-medium mb-1">Total Sales</h3>
                <p className="text-3xl font-black text-white">{dailyReport?.total_sales || 0}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Banknote className="w-6 h-6 text-amber-500" />
                  </div>
                </div>
                <h3 className="text-zinc-400 text-sm font-medium mb-1">Total Tax</h3>
                <p className="text-3xl font-black text-white">R {dailyReport?.total_tax?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <Trash2 className="w-6 h-6 text-red-500" />
                  </div>
                </div>
                <h3 className="text-zinc-400 text-sm font-medium mb-1">Total Discounts</h3>
                <p className="text-3xl font-black text-white">R {dailyReport?.total_discount?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
            
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4">Sales Performance</h3>
              <div className="h-64 flex items-end gap-2 px-4">
                {[40, 70, 45, 90, 65, 80, 55, 75, 60, 85, 95, 50].map((h, i) => (
                  <div key={i} className="flex-1 bg-emerald-500/20 rounded-t-lg relative group">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      className="absolute bottom-0 inset-x-0 bg-emerald-500 rounded-t-lg group-hover:bg-emerald-400 transition-colors"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <span>08:00</span>
                <span>12:00</span>
                <span>16:00</span>
                <span>20:00</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Payment Modal */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm no-print">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Finalize Payment</h2>
                <button onClick={() => setIsPaymentModalOpen(false)} className="text-zinc-500 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="text-center">
                  <p className="text-zinc-500 text-sm font-medium mb-1">Amount Due</p>
                  <p className="text-5xl font-black text-emerald-500">R {total.toFixed(2)}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setPaymentMethod('cash')}
                    className={cn(
                      "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all",
                      paymentMethod === 'cash' ? "border-emerald-500 bg-emerald-500/5 text-emerald-500" : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
                    )}
                  >
                    <Banknote className="w-8 h-8" />
                    <span className="font-bold">Cash</span>
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('card')}
                    className={cn(
                      "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all",
                      paymentMethod === 'card' ? "border-emerald-500 bg-emerald-500/5 text-emerald-500" : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
                    )}
                  >
                    <CreditCard className="w-8 h-8" />
                    <span className="font-bold">Card</span>
                  </button>
                </div>

                {paymentMethod === 'cash' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Amount Received</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">R</span>
                      <input 
                        type="number"
                        autoFocus
                        placeholder="0.00"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-4 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        value={amountPaid}
                        onChange={e => setAmountPaid(e.target.value)}
                      />
                    </div>
                    {parseFloat(amountPaid) > total && (
                      <div className="flex justify-between items-center p-4 bg-zinc-800 rounded-xl border border-zinc-700">
                        <span className="text-zinc-400 font-medium">Change Due</span>
                        <span className="text-xl font-black text-emerald-500">R {(parseFloat(amountPaid) - total).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                <button 
                  onClick={processSale}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 rounded-2xl text-lg transition-all shadow-xl shadow-emerald-500/20"
                >
                  Complete Transaction
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Thermal Receipt (Hidden in UI, visible in print) */}
      <div className="print-only font-mono text-black p-4 w-[80mm] mx-auto bg-white">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold uppercase">SuperPOS Market</h1>
          <p className="text-xs">123 Supermarket Way, Cape Town</p>
          <p className="text-xs">VAT NO: 4010203040</p>
          <p className="text-xs">TEL: +27 21 555 0123</p>
        </div>

        <div className="border-t border-b border-black border-dashed py-2 mb-4 text-xs">
          <div className="flex justify-between">
            <span>Invoice:</span>
            <span>{lastSale?.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{lastSale?.date}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier:</span>
            <span>{user.name}</span>
          </div>
        </div>

        <div className="mb-4 text-xs">
          <div className="flex justify-between font-bold mb-1">
            <span className="w-1/2">Item</span>
            <span className="w-1/6 text-center">Qty</span>
            <span className="w-1/3 text-right">Total</span>
          </div>
          {lastSale?.items.map((item: any, i: number) => (
            <div key={i} className="flex justify-between mb-1">
              <span className="w-1/2 truncate">{item.name}</span>
              <span className="w-1/6 text-center">{item.quantity}</span>
              <span className="w-1/3 text-right">{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-black border-dashed pt-2 space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>R {lastSale?.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT (15%):</span>
            <span>R {lastSale?.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL:</span>
            <span>R {lastSale?.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Payment ({lastSale?.paymentMethod}):</span>
            <span>R {lastSale?.amountPaid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Change:</span>
            <span>R {lastSale?.change.toFixed(2)}</span>
          </div>
        </div>

        <div className="text-center mt-8 text-xs">
          <p>THANK YOU FOR SHOPPING!</p>
          <p>PLEASE KEEP YOUR RECEIPT</p>
          <div className="mt-4 flex justify-center">
            {/* Simulated QR Code */}
            <div className="w-20 h-20 border border-black flex items-center justify-center p-1">
              <div className="w-full h-full bg-black flex flex-wrap">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className={cn("w-1/4 h-1/4", i % 3 === 0 ? "bg-white" : "bg-black")} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
        }
        .print-only { display: none; }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
    </div>
  );
}
