import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Product, Sale, SaleItem, SaleStatus, UserRole, PaymentDetails } from '../types';
import { getProducts, getSales, createSale, updateSale, completeSale, cancelSale } from '../services/mockBackend';
import { Search, PlusCircle, Check, Trash2, CheckCircle, Clock, XCircle, User, CreditCard, DollarSign, Edit2, MapPin, Lock, X, FileText, AlertTriangle, Eye, ArrowRight } from 'lucide-react';
import { useToast } from '../context/ToastContext';

// Helper functions for currency
const formatMoney = (value: number) => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseMoney = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return parseInt(digits || "0") / 100;
};

export const Sales: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'new' | 'pending' | 'history'>('new');
  
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);

  // --- POS STATE (New/Edit Sale) ---
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [isCashierConfirming, setIsCashierConfirming] = useState(false); // New state for Cashier Mode
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [posClient, setPosClient] = useState('');
  
  // Product Search State
  const [searchCode, setSearchCode] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState(0);

  // Monetary Values
  const [posDiscount, setPosDiscount] = useState<number>(0);
  const [posFreight, setPosFreight] = useState<number>(0);
  const [posOther, setPosOther] = useState<number>(0);
  
  // Detailed Payments
  const [payments, setPayments] = useState<PaymentDetails>({
    cash: 0, debit: 0, credit: 0, pix: 0, 
    boleto: 0, creditStore: 0, ticket: 0, transfer: 0, cheque: 0
  });
  
  // Installments logic
  const [creditInstallments, setCreditInstallments] = useState<number>(1);

  // Info
  const [obs, setObs] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [email, setEmail] = useState('');
  const [cashierIdent, setCashierIdent] = useState('');
  const [purchaseOrder, setPurchaseOrder] = useState('');

  // --- MODAL STATES ---
  // Edit Item Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editItemIndex, setEditItemIndex] = useState<number | null>(null);
  const [editItemData, setEditItemData] = useState<Partial<SaleItem>>({});

  // Discount Modal
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [tempDiscountValue, setTempDiscountValue] = useState(0);
  const [tempDiscountPercent, setTempDiscountPercent] = useState(0);
  const [discountToken, setDiscountToken] = useState('');

  // Cancel Sale Modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);

  // View Details Modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [saleToView, setSaleToView] = useState<Sale | null>(null);

  const isSalesperson = user?.role === UserRole.SALESPERSON || user?.role === UserRole.MANAGER;
  const isCashier = user?.role === UserRole.CASHIER || user?.role === UserRole.MANAGER;
  const isManager = user?.role === UserRole.MANAGER;

  const refreshData = async () => {
    setLoading(true);
    const [pData, sData] = await Promise.all([getProducts(), getSales()]);
    setProducts(pData);
    setSales(sData.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Reset installments if discount is applied
  useEffect(() => {
    if (posDiscount > 0) {
      setCreditInstallments(1);
    }
  }, [posDiscount]);

  // --- CALCULATIONS ---
  const subTotal = cart.reduce((acc: number, item) => acc + item.total, 0);
  const totalGeneral = Math.max(0, subTotal - posDiscount + posFreight + posOther);
  
  // PaymentDetails values are numbers, direct addition is safe
  const totalPaid = (Object.values(payments) as number[]).reduce((acc: number, val: number) => acc + val, 0);
  const remaining = Math.max(0, totalGeneral - totalPaid);

  // --- HANDLERS ---

  const handleProductSearch = (val: string) => {
    if (isCashierConfirming) return; // Block search in cashier mode
    setSearchCode(val);
    if (val.length > 0) {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  };

  const selectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchCode(product.name); // Display name after selection
    setItemPrice(product.price);
    setItemQty(1);
    setShowSearchResults(false);
  };

  const handleBlurSearch = () => {
    // Delay hiding to allow click event on list item
    setTimeout(() => setShowSearchResults(false), 200);
  };

  const handleAddItem = () => {
    if (isCashierConfirming) return; // Block add in cashier mode

    if (!selectedProduct) {
      toast.error("Selecione um produto válido.");
      return;
    }
    // Stock check
    const currentInCart = cart.filter(i => i.productId === selectedProduct.id).reduce((acc, i) => acc + i.quantity, 0);
    if (selectedProduct.stock < (currentInCart + itemQty)) {
      toast.error(`Estoque insuficiente! Disponível: ${selectedProduct.stock}`);
      return;
    }

    const newItem: SaleItem = {
      productId: selectedProduct.id,
      productCode: selectedProduct.code,
      productName: selectedProduct.name,
      quantity: itemQty,
      unitPrice: itemPrice,
      originalPrice: selectedProduct.price, // Store original price for discount calculation
      total: itemPrice * itemQty,
      unit: selectedProduct.unit || 'UNID',
      observation: ''
    };

    setCart(prev => [...prev, newItem]);
    
    // Reset input for next item
    setSearchCode('');
    setSelectedProduct(null);
    setItemQty(1);
    setItemPrice(0);
    if(searchInputRef.current) searchInputRef.current.focus();
  };

  const handleRemoveItem = (idx: number) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  // --- EDIT ITEM MODAL ---
  const openEditModal = (idx: number) => {
    const item = cart[idx];
    setEditItemIndex(idx);
    setEditItemData({ ...item });
    setEditModalOpen(true);
  };

  const saveEditItem = () => {
    if (editItemIndex !== null && editItemData.quantity) {
      
      const original = editItemData.originalPrice || editItemData.unitPrice || 0;
      let finalPrice = editItemData.unitPrice;

      // Rule 1: Empty or Zero -> Revert to Original
      if (!finalPrice || finalPrice === 0) {
        finalPrice = original;
        toast.info("Valor inválido. Revertido para o preço original.");
      }

      // Rule 2: 6% Validation Logic for Individual Items
      // Allow max 6% discount (price must be >= 94% of original)
      const minAllowedPrice = original * 0.94;
      
      if (finalPrice! < minAllowedPrice) {
        finalPrice = minAllowedPrice;
        toast.info("Preço ajustado para o limite máximo de 6% de desconto.");
      }

      const updatedCart = [...cart];
      const newItem = {
        ...updatedCart[editItemIndex],
        ...editItemData,
        unitPrice: finalPrice,
        total: (editItemData.quantity || 0) * (finalPrice || 0)
      } as SaleItem;
      updatedCart[editItemIndex] = newItem;
      setCart(updatedCart);
      setEditModalOpen(false);
    }
  };

  // --- DISCOUNT MODAL ---
  const openDiscountModal = () => {
    if (isCashierConfirming) return; // Block discount edit in cashier mode
    
    // Need to calculate current effective percentage based on Total Original Value vs Current Total
    const totalOriginalValue = cart.reduce((acc, item) => acc + (item.quantity * (item.originalPrice || item.unitPrice)), 0);
    const currentSubTotal = subTotal; // This is sum of (quantity * unitPrice) which might be already discounted
    const discountFromItems = totalOriginalValue - currentSubTotal;
    
    // If opening, we start with existing global discount
    setTempDiscountValue(posDiscount);
    
    // Calculate effective percentage of TOTAL discount (Item Level + Global)
    const totalDiscount = discountFromItems + posDiscount;
    const effectivePercent = totalOriginalValue > 0 ? (totalDiscount / totalOriginalValue) * 100 : 0;
    
    setTempDiscountPercent(effectivePercent);
    setDiscountToken('');
    setDiscountModalOpen(true);
  };

  const handleDiscountValueChange = (val: number) => {
    setTempDiscountValue(val);
    
    // Recalculate percent based on Total Original Value
    const totalOriginalValue = cart.reduce((acc, item) => acc + (item.quantity * (item.originalPrice || item.unitPrice)), 0);
    const currentSubTotal = subTotal;
    const discountFromItems = totalOriginalValue - currentSubTotal;
    const totalDiscount = discountFromItems + val;
    
    setTempDiscountPercent(totalOriginalValue > 0 ? (totalDiscount / totalOriginalValue) * 100 : 0);
  };

  const handleDiscountPercentChange = (pct: number) => {
    setTempDiscountPercent(pct);
    
    // Reverse calculation: given Target Total % Discount, how much Global Discount (R$) is needed?
    const totalOriginalValue = cart.reduce((acc, item) => acc + (item.quantity * (item.originalPrice || item.unitPrice)), 0);
    const currentSubTotal = subTotal;
    const discountFromItems = totalOriginalValue - currentSubTotal;
    
    const targetTotalDiscount = (totalOriginalValue * pct) / 100;
    const neededGlobalDiscount = Math.max(0, targetTotalDiscount - discountFromItems);
    
    setTempDiscountValue(neededGlobalDiscount);
  };
  
  const handleDiscountTotalChange = (totalComDesconto: number) => {
     // User sets the final price they want to pay
     const totalOriginalValue = cart.reduce((acc, item) => acc + (item.quantity * (item.originalPrice || item.unitPrice)), 0);
     const currentSubTotal = subTotal;
     
     // The difference between Current Subtotal (which might have item discounts) and Target Total
     // is the Global Discount
     const newGlobalDiscount = Math.max(0, currentSubTotal - totalComDesconto);
     
     setTempDiscountValue(newGlobalDiscount);

     // Update percent visual
     const discountFromItems = totalOriginalValue - currentSubTotal;
     const totalDiscount = discountFromItems + newGlobalDiscount;
     setTempDiscountPercent(totalOriginalValue > 0 ? (totalDiscount / totalOriginalValue) * 100 : 0);
  };

  const confirmDiscount = () => {
    // Final check on total percentage
    // Logic: Total Discount (Items + Global) / Total Original Value
    const totalOriginalValue = cart.reduce((acc, item) => acc + (item.quantity * (item.originalPrice || item.unitPrice)), 0);
    const currentSubTotal = subTotal;
    const discountFromItems = totalOriginalValue - currentSubTotal;
    const totalDiscount = discountFromItems + tempDiscountValue;
    
    const finalPercent = totalOriginalValue > 0 ? (totalDiscount / totalOriginalValue) * 100 : 0;

    // Token check rule: only if > 6%
    if (finalPercent > 6 && discountToken.length < 3) {
      toast.error(`Desconto total (${finalPercent.toFixed(2)}%) excede 6%. Token obrigatório.`);
      return;
    }
    setPosDiscount(tempDiscountValue);
    setDiscountModalOpen(false);
  };

  // --- LOAD EDIT SALE ---
  const handleEditSale = (sale: Sale) => {
    setEditingSaleId(sale.id);
    
    // Ensure productCode is populated even for old sales that might miss it in items JSON
    const hydratedItems = sale.items.map(item => ({
      ...item,
      productCode: item.productCode || products.find(p => p.id === item.productId)?.code
    }));

    setCart(hydratedItems);
    setPosClient(sale.clientName || '');
    setPosDiscount(sale.discount || 0);
    setPosFreight(sale.freight || 0);
    setPosOther(sale.otherCosts || 0);
    setPayments(sale.payments || { cash: 0, debit: 0, credit: 0, pix: 0, boleto: 0, creditStore: 0, ticket: 0, transfer: 0, cheque: 0 });
    setCreditInstallments(sale.installments || 1);
    setObs(sale.observation || '');
    setDeliveryAddress(sale.deliveryAddress || '');
    setEmail(sale.customerEmail || '');
    setPurchaseOrder(sale.purchaseOrder || '');
    setCashierIdent(sale.cashierIdent || '');
    
    setActiveTab('new');
  };

  const handleCashierOpenSale = (sale: Sale) => {
    handleEditSale(sale);
    setIsCashierConfirming(true);
  };

  // --- VIEW SALE HANDLER ---
  const handleViewSale = (sale: Sale) => {
    setSaleToView(sale);
    setViewModalOpen(true);
  };

  // --- RESET STATE ---
  const resetSalesState = () => {
    setEditingSaleId(null);
    setIsCashierConfirming(false);
    setCart([]);
    setPosClient('');
    setPosDiscount(0); setPosFreight(0); setPosOther(0);
    setPayments({ cash: 0, debit: 0, credit: 0, pix: 0, 
    boleto: 0, creditStore: 0, ticket: 0, transfer: 0, cheque: 0 });
    setCreditInstallments(1);
    setObs(''); setDeliveryAddress(''); setEmail(''); setPurchaseOrder('');
    setCashierIdent('');
    setSearchCode('');
    setSelectedProduct(null);
  };

  // --- FINAL SUBMIT ---
  const handleSubmitSale = useCallback(async (asBudget = false) => {
    if (cart.length === 0) {
      toast.error("Adicione produtos à venda.");
      return;
    }

    // --- PAYMENT VALIDATION (Sales Order Only) ---
    if (!asBudget) {
      const currentTotalPaid = (Object.values(payments) as number[]).reduce((a, b) => a + b, 0);

      if (totalGeneral > 0) {
        // 1. Check if any payment was selected
        if (currentTotalPaid === 0) {
           toast.error("Selecione uma forma de pagamento antes de finalizar.");
           return;
        }

        // 2. Strict Check: Payment must match Total
        if (Math.abs(currentTotalPaid - totalGeneral) > 0.05) {
           const diff = totalGeneral - currentTotalPaid;
           const diffMsg = diff > 0 
             ? `Falta R$ ${formatMoney(diff)}` 
             : `Sobra R$ ${formatMoney(Math.abs(diff))}`;
           
           toast.error(`Pagamento divergente! ${diffMsg}.`);
           return;
        }
      }
    }
    
    const salePayload: Partial<Sale> = {
      items: cart,
      sellerId: user!.id,
      sellerName: user!.name,
      clientName: posClient,
      discount: posDiscount, 
      freight: posFreight,
      otherCosts: posOther,
      payments: payments,
      installments: creditInstallments,
      totalValue: totalGeneral,
      observation: obs,
      deliveryAddress: deliveryAddress,
      customerEmail: email,
      purchaseOrder: purchaseOrder,
      cashierIdent: cashierIdent,
      status: asBudget ? SaleStatus.BUDGET : SaleStatus.PENDING
    };

    try {
      if (editingSaleId) {
        await updateSale({ ...salePayload, id: editingSaleId });
        toast.success(asBudget ? 'Orçamento atualizado!' : 'Venda atualizada!');
      } else {
        await createSale(salePayload);
        toast.success(asBudget ? 'Orçamento salvo com sucesso!' : 'Venda registrada com sucesso!');
      }
      
      resetSalesState();
      refreshData();
      
      // Focus back on client or product search for rapid entry
      const clientInput = document.getElementById('client-input');
      if(clientInput) clientInput.focus();

    } catch (error) {
      console.error(error);
      toast.error('Erro ao processar venda.');
    }
  }, [cart, user, posClient, posDiscount, posFreight, posOther, payments, creditInstallments, totalGeneral, obs, deliveryAddress, email, purchaseOrder, cashierIdent, editingSaleId, toast]);

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only active in New Sale tab
      if (activeTab !== 'new') return;

      if (e.key === 'F4') {
        e.preventDefault();
        if (isCashierConfirming) {
            handleCashierFinalize();
        } else {
            handleSubmitSale(false);
        }
      }
      if (e.key === 'F8') {
        e.preventDefault();
        if (!isCashierConfirming) {
            handleSubmitSale(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, handleSubmitSale, isCashierConfirming]);


  // --- UTILS ---
  const handlePaymentChange = (key: keyof PaymentDetails, value: number) => {
    setPayments(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handlePaymentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, key: keyof PaymentDetails) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Auto-complete with remaining value + existing value in this field
      const currentVal = payments[key];
      const newValue = currentVal + remaining;
      handlePaymentChange(key, newValue);
    }
  };

  // Cashier Finalize: Update payment details first, then Complete.
  const handleCashierFinalize = async () => {
    if (!editingSaleId) return;
    
    // Check if fully paid
    const paid = (Object.values(payments) as number[]).reduce((a, b) => a + b, 0);
    // Tolerance for floating point
    if (Math.abs(paid - totalGeneral) > 0.05) {
        toast.error(`Valor incorreto! Falta R$ ${formatMoney(totalGeneral - paid)}`);
        return;
    }

    try {
        // 1. Update Sale with new Payment Details (in case Cashier changed them)
        await updateSale({
            id: editingSaleId,
            payments: payments,
            installments: creditInstallments,
            cashierIdent: cashierIdent // Save cashier ident name if typed
        });

        // 2. Complete Sale (Stock & Status)
        await completeSale(editingSaleId, user!.id, user!.name);
        
        toast.success("Venda recebida e finalizada com sucesso!");
        resetSalesState();
        refreshData();
    } catch (e: any) {
        toast.error(e.message);
    }
  };

  // --- CANCEL SALE HANDLERS ---
  const requestCancelSale = (sale: Sale) => {
    setSaleToCancel(sale);
    setCancelModalOpen(true);
  };

  const executeCancelSale = async () => {
    if (!saleToCancel) return;
    try {
      await cancelSale(saleToCancel.id);
      toast.success(`Venda #${saleToCancel.id} cancelada com sucesso.`);
      await refreshData();
      setCancelModalOpen(false);
      setSaleToCancel(null);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao cancelar: " + (e.message || "Erro desconhecido"));
    }
  };

  // Filter Active Products only for POS Search
  const filteredProducts = products.filter(p => 
    p.active && ( // Only active products
      p.name.toLowerCase().includes(searchCode.toLowerCase()) || 
      p.code.toLowerCase().includes(searchCode.toLowerCase())
    )
  );

  return (
    <div className="space-y-4 font-sans text-sm">
      {/* TABS */}
      <div className="flex border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 rounded-t-xl no-print transition-colors">
        {(isSalesperson || isCashierConfirming) && (
          <button
            onClick={() => {
                if(isSalesperson) setActiveTab('new');
            }}
            disabled={!isSalesperson && !isCashierConfirming}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'new' ? 'border-sky-600 text-sky-700 dark:text-sky-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            {editingSaleId ? <Edit2 size={14} className="mr-2"/> : <PlusCircle size={14} className="mr-2"/>}
            {editingSaleId ? (isCashierConfirming ? 'Conferência de Caixa' : 'Editando Venda') : 'Nova Venda (POS)'}
          </button>
        )}
        {isCashier && (
          <button
            onClick={() => {
                setActiveTab('pending');
                resetSalesState();
            }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pending' ? 'border-sky-600 text-sky-700 dark:text-sky-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Frente de Caixa
          </button>
        )}
        <button
          onClick={() => {
              setActiveTab('history');
              resetSalesState();
          }}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history' ? 'border-sky-600 text-sky-700 dark:text-sky-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
        >
          Histórico
        </button>
      </div>

      {/* --- TAB: NEW SALE (POS STYLE) --- */}
      {activeTab === 'new' && (isSalesperson || isCashierConfirming) && (
        <div className="bg-gray-100 dark:bg-slate-900 flex flex-col gap-4 max-w-[1400px] mx-auto pb-10 mt-4 transition-colors">
          
          {/* Edit/Cashier Header Banner */}
          {editingSaleId && (
            <div className={`px-4 py-3 rounded border flex justify-between items-center shadow-sm
                ${isCashierConfirming 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800' 
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
                }
            `}>
              <div className="font-bold flex items-center">
                  {isCashierConfirming ? <CheckCircle size={18} className="mr-2"/> : <Edit2 size={18} className="mr-2"/>}
                  {isCashierConfirming ? `CONFERÊNCIA DE CAIXA - VENDA #${editingSaleId}` : `MODO DE EDIÇÃO - VENDA #${editingSaleId}`}
              </div>
              <button onClick={resetSalesState} className="text-sm underline hover:opacity-80">
                  {isCashierConfirming ? 'Cancelar Conferência' : 'Cancelar Edição'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* LEFT MAIN COLUMN */}
            <div className="xl:col-span-2 space-y-4">
              
              {/* CLIENT BOX */}
              <div className="bg-white dark:bg-slate-800 p-0 rounded shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="bg-slate-800 dark:bg-slate-950 text-white px-3 py-1 text-xs font-bold flex items-center">
                   <User size={12} className="mr-2" /> Cliente do pedido
                </div>
                <div className="p-3 flex">
                  <div className="bg-slate-700 dark:bg-slate-900 text-white w-10 flex items-center justify-center rounded-l">
                    <Search size={14} />
                  </div>
                  <input 
                    id="client-input"
                    type="text" 
                    disabled={isCashierConfirming}
                    placeholder="Digite o nome ou CPF/CNPJ..." 
                    className="flex-1 border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm focus:outline-none focus:border-sky-500 rounded-r uppercase font-medium bg-white dark:bg-slate-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:text-gray-500"
                    value={posClient}
                    onChange={e => setPosClient(e.target.value)}
                  />
                </div>
              </div>

              {/* NEW ITEM ENTRY */}
              <div className="bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 relative">
                <div className="bg-slate-800 dark:bg-slate-950 text-white px-3 py-2 text-sm font-bold flex items-center justify-between rounded-t">
                  <div className="flex items-center">
                    <PlusCircle size={16} className="mr-2" /> Novo Item
                  </div>
                  <span className="text-xs text-gray-300 font-normal">Item R$ { formatMoney(itemQty * itemPrice) }</span>
                </div>
                
                <div className={`p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end ${isCashierConfirming ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="sm:col-span-5 relative">
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">Pesquise o produto</label>
                    <input 
                      ref={searchInputRef}
                      type="text"
                      className="w-full bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded px-2 py-2 text-sm focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 font-medium uppercase dark:text-yellow-100 placeholder-yellow-800/50 dark:placeholder-yellow-200/30" 
                      placeholder="Pesquise aqui o produto a ser vendido"
                      value={searchCode}
                      onChange={e => handleProductSearch(e.target.value)}
                      onFocus={() => searchCode && setShowSearchResults(true)}
                      onBlur={handleBlurSearch}
                      autoComplete="off"
                      disabled={isCashierConfirming}
                    />
                    {/* Custom Dropdown Results */}
                    {showSearchResults && filteredProducts.length > 0 && (
                      <div className="absolute z-50 left-0 top-full mt-1 w-[150%] bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 shadow-xl rounded-md max-h-64 overflow-y-auto">
                        {filteredProducts.map(product => (
                          <div 
                            key={product.id}
                            onMouseDown={() => selectProduct(product)} // use onMouseDown to trigger before input blur
                            className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-gray-800 dark:text-gray-200 text-xs uppercase">{product.name}</span>
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">R$ {formatMoney(product.price)}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
                              <span>Cód: {product.code}</span>
                              <span>Estoque: {product.stock} {product.unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {showSearchResults && filteredProducts.length === 0 && searchCode && (
                       <div className="absolute z-50 left-0 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 shadow-md rounded-md p-3 text-xs text-gray-500 dark:text-gray-400 text-center">
                         Nenhum produto encontrado.
                       </div>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">R$ Unitário</label>
                    <input 
                      type="text" 
                      className="w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-2 py-2 text-sm text-right text-gray-900 dark:text-white font-bold"
                      value={formatMoney(itemPrice)}
                      readOnly
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">Quantidade</label>
                    <input 
                      type="number" 
                      min="1"
                      className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-2 text-sm text-center font-bold bg-white dark:bg-slate-700 dark:text-white"
                      value={itemQty}
                      onChange={e => setItemQty(parseInt(e.target.value) || 1)}
                      disabled={isCashierConfirming}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">R$ Total</label>
                    <input 
                      type="text" 
                      className="w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-2 py-2 text-sm text-right font-bold text-gray-900 dark:text-white"
                      value={formatMoney(itemPrice * itemQty)}
                      readOnly
                    />
                  </div>
                  <div className="sm:col-span-1">
                     <button 
                      onClick={handleAddItem}
                      disabled={isCashierConfirming}
                      className="w-full bg-amber-400 hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500 text-slate-900 dark:text-white font-bold py-2 rounded flex items-center justify-center transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       <Check size={20} />
                     </button>
                  </div>
                </div>
              </div>

              {/* CART TABLE */}
              <div className="bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden min-h-[200px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className="px-3 py-2 font-semibold w-2/3">Descrição do produto</th>
                      <th className="px-3 py-2 font-semibold text-center">Qtde</th>
                      <th className="px-3 py-2 font-semibold text-center">Unid</th>
                      <th className="px-3 py-2 font-semibold text-right">Vlr Unit</th>
                      <th className="px-3 py-2 font-semibold text-right">Total</th>
                      <th className="px-3 py-2 text-center w-20">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {cart.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50 dark:hover:bg-slate-700/50 group transition-colors">
                        <td className="px-3 py-2">
                          <div className="font-bold text-gray-700 dark:text-gray-200 uppercase">{item.productName}</div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500">
                             {/* Display Product Code instead of ID, fallback to ID if empty */}
                             {item.productCode || item.productId} {item.observation && `- ${item.observation}`}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-orange-600 dark:text-orange-400">{item.quantity}</td>
                        <td className="px-3 py-2 text-center text-gray-500 dark:text-gray-400">{item.unit || 'UNID'}</td>
                        <td className="px-3 py-2 text-right dark:text-gray-300">{formatMoney(item.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-800 dark:text-gray-200">{formatMoney(item.total)}</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex justify-center space-x-1">
                             <button 
                                onClick={() => {
                                  if (isCashierConfirming) return;
                                  if (posDiscount > 0) {
                                    toast.info("Remova o desconto global para editar itens.");
                                    return;
                                  }
                                  openEditModal(idx);
                                }}
                                disabled={isCashierConfirming || posDiscount > 0}
                                className={`p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-slate-600 transition-colors ${(posDiscount > 0 || isCashierConfirming) ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                title={isCashierConfirming ? "Bloqueado no caixa" : (posDiscount > 0 ? "Remova o desconto para editar" : "Editar")}
                             >
                              <Edit2 size={14} />
                             </button>
                             <button 
                                onClick={() => handleRemoveItem(idx)} 
                                disabled={isCashierConfirming}
                                className={`p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-100 dark:hover:bg-slate-600 transition-colors ${isCashierConfirming ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                title="Excluir"
                             >
                              <Trash2 size={14} />
                             </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {cart.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-gray-300 dark:text-gray-600 italic">
                          Nenhum item adicionado ao carrinho.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* TOTALS ROW */}
              <div className="bg-white dark:bg-slate-800 p-3 rounded shadow-sm border border-gray-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 border-b dark:border-slate-700 pb-1 flex items-center">
                  <DollarSign size={14} className="mr-1"/> Totais do pedido
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 dark:text-gray-400 uppercase block">R$ Produtos</label>
                    <input type="text" readOnly value={formatMoney(subTotal)} className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-gray-50 dark:bg-slate-700 dark:text-white text-right" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 dark:text-gray-400 uppercase block">R$ Descontos</label>
                    <div className="flex">
                      <input 
                        type="text" 
                        readOnly
                        value={formatMoney(posDiscount)} 
                        className="w-full border border-gray-300 dark:border-slate-600 rounded-l px-2 py-1 text-sm bg-gray-50 dark:bg-slate-700 dark:text-white text-right" 
                      />
                      <button 
                        onClick={openDiscountModal} 
                        disabled={isCashierConfirming}
                        className={`bg-slate-600 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-2 rounded-none text-xs flex items-center justify-center ${isCashierConfirming ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Lock size={10} />
                      </button>
                      <button 
                        onClick={() => setPosDiscount(0)}
                        disabled={isCashierConfirming}
                        className={`bg-slate-500 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500 text-white px-2 rounded-r text-xs flex items-center justify-center ${isCashierConfirming ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <XCircle size={10} />
                      </button>
                    </div>
                  </div>
                   <div>
                    <label className="text-[10px] text-gray-500 dark:text-gray-400 uppercase block">R$ Outros</label>
                    <input 
                      type="text" 
                      value={formatMoney(posOther)} 
                      onChange={e => setPosOther(parseMoney(e.target.value))}
                      disabled={isCashierConfirming}
                      className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-400 outline-none text-right bg-white dark:bg-slate-700 dark:text-white disabled:bg-gray-50 dark:disabled:bg-slate-800" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 dark:text-gray-400 uppercase block">R$ Frete</label>
                    <input 
                      type="text" 
                      value={formatMoney(posFreight)} 
                      onChange={e => setPosFreight(parseMoney(e.target.value))}
                      disabled={isCashierConfirming}
                      className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm focus:border-blue-400 outline-none text-right bg-white dark:bg-slate-700 dark:text-white disabled:bg-gray-50 dark:disabled:bg-slate-800" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 dark:text-gray-400 uppercase block font-bold">R$ Total</label>
                    <input type="text" readOnly value={formatMoney(totalGeneral)} className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-gray-50 dark:bg-slate-700 font-bold text-gray-700 dark:text-white text-right" />
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              
              {/* TOTAL BOX */}
              <div className="bg-sky-500 dark:bg-sky-600 text-white p-5 rounded shadow-md relative overflow-hidden flex flex-col justify-center">
                <div className="absolute top-0 right-0 p-4 opacity-20">
                  <CheckCircle size={64} />
                </div>
                <h3 className="text-xs font-bold uppercase mb-1 flex items-center">
                  <Check size={14} className="mr-1" /> Total Geral
                </h3>
                <div className="text-4xl font-bold tracking-tight z-10">
                  R$ {formatMoney(totalGeneral)}
                </div>
              </div>

              {/* PAYMENTS GRID */}
              <div className="bg-gray-100 dark:bg-slate-900 p-4 rounded shadow-inner border border-gray-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-3 border-b border-gray-200 dark:border-slate-700 pb-1">
                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center uppercase">
                    <CreditCard size={12} className="mr-1" /> Pagamentos
                  </h4>
                  <span className={`text-xs font-bold ${remaining > 0.01 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    TOTAL RESTANTE R$ {formatMoney(remaining)}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 dark:text-gray-400 block">Dinheiro</label>
                    <input type="text" className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm text-right bg-white dark:bg-slate-700 dark:text-white" placeholder="0,00" 
                      value={payments.cash ? formatMoney(payments.cash) : ''} 
                      onChange={e => handlePaymentChange('cash', parseMoney(e.target.value))}
                      onKeyDown={e => handlePaymentKeyDown(e, 'cash')}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 dark:text-gray-400 block">Cart/Débito</label>
                    <input type="text" className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm text-right bg-white dark:bg-slate-700 dark:text-white" placeholder="0,00" 
                      value={payments.debit ? formatMoney(payments.debit) : ''} 
                      onChange={e => handlePaymentChange('debit', parseMoney(e.target.value))}
                      onKeyDown={e => handlePaymentKeyDown(e, 'debit')}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 dark:text-gray-400 block">Cart/Crédito</label>
                    <div className="flex">
                       <input type="text" className="w-full border border-gray-300 dark:border-slate-600 rounded-l px-2 py-1 text-sm text-right bg-white dark:bg-slate-700 dark:text-white" placeholder="0,00" 
                         value={payments.credit ? formatMoney(payments.credit) : ''} 
                         onChange={e => handlePaymentChange('credit', parseMoney(e.target.value))}
                         onKeyDown={e => handlePaymentKeyDown(e, 'credit')}
                       />
                       <select 
                         value={creditInstallments}
                         onChange={(e) => setCreditInstallments(parseInt(e.target.value))}
                         disabled={posDiscount > 0}
                         className="bg-white dark:bg-slate-700 border border-l-0 border-gray-300 dark:border-slate-600 text-[10px] rounded-r px-1 text-gray-500 dark:text-gray-300 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-slate-800"
                        >
                          {[...Array(10)].map((_, i) => (
                            <option key={i+1} value={i+1}>{i+1}X</option>
                          ))}
                       </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 dark:text-gray-400 block">PIX</label>
                    <input type="text" className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm text-right bg-white dark:bg-slate-700 dark:text-white" placeholder="0,00" 
                      value={payments.pix ? formatMoney(payments.pix) : ''} 
                      onChange={e => handlePaymentChange('pix', parseMoney(e.target.value))}
                      onKeyDown={e => handlePaymentKeyDown(e, 'pix')}
                    />
                  </div>
                   <div>
                    <label className="text-[10px] text-gray-500 dark:text-gray-400 block">Boleto</label>
                    <input type="text" className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm text-right bg-white dark:bg-slate-700 dark:text-white" placeholder="0,00" 
                      value={payments.boleto ? formatMoney(payments.boleto) : ''} 
                      onChange={e => handlePaymentChange('boleto', parseMoney(e.target.value))}
                      onKeyDown={e => handlePaymentKeyDown(e, 'boleto')}
                    />
                  </div>
                   <div className="col-span-1">
                    <label className="text-[10px] text-gray-500 dark:text-gray-400 block">Crédito/Loja</label>
                    <input type="text" className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm text-right bg-white dark:bg-slate-700 dark:text-white" placeholder="0,00" 
                      value={payments.creditStore ? formatMoney(payments.creditStore) : ''} 
                      onChange={e => handlePaymentChange('creditStore', parseMoney(e.target.value))}
                      onKeyDown={e => handlePaymentKeyDown(e, 'creditStore')}
                    />
                  </div>
                </div>
              </div>

              {/* COMPLEMENTARY INFO */}
              <div className="bg-white dark:bg-slate-800 p-3 rounded shadow-sm border border-gray-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <FileText size={12} className="mr-1"/> Informações complementares
                </h4>
                <textarea 
                  className="w-full border border-gray-300 dark:border-slate-600 rounded p-2 text-xs h-14 resize-none mb-2 focus:border-blue-400 outline-none bg-white dark:bg-slate-700 dark:text-white disabled:bg-gray-50 dark:disabled:bg-slate-800"
                  placeholder="Digite as informações complementares (NF-e)"
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                  disabled={isCashierConfirming}
                ></textarea>
                <input 
                  type="email" 
                  placeholder="E-mail para envio do pedido de venda e NF-e" 
                  className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-700 dark:text-white disabled:bg-gray-50 dark:disabled:bg-slate-800"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={isCashierConfirming}
                />
              </div>

               {/* DELIVERY */}
               <div className="bg-white dark:bg-slate-800 p-3 rounded shadow-sm border border-gray-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <MapPin size={12} className="mr-1"/> Endereço de entrega
                </h4>
                <div className="bg-gray-50 dark:bg-slate-700/50 p-3 text-center rounded border border-dashed border-gray-300 dark:border-slate-600">
                   <span className="text-xs text-gray-500 dark:text-gray-400 font-bold block">SITUAÇÃO: CLIENTE RETIRA NA LOJA</span>
                   <button 
                    disabled={isCashierConfirming}
                    className="text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 mt-1 flex items-center justify-center w-full disabled:text-gray-400 disabled:cursor-not-allowed"
                    onClick={() => {
                       const addr = prompt("Digite o endereço de entrega:");
                       if(addr) setDeliveryAddress(addr);
                    }}
                   >
                     <PlusCircle size={12} className="mr-1" /> {deliveryAddress ? 'Alterar endereço' : 'Adicionar endereço de entrega'}
                   </button>
                   {deliveryAddress && <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 break-words">{deliveryAddress}</div>}
                </div>
              </div>

            </div>
          </div>

          {/* FOOTER BAR */}
          <div className="bg-white dark:bg-slate-800 p-3 rounded shadow-sm border border-gray-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block uppercase">Nome de identificação no caixa</label>
              <input 
                className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white" 
                placeholder="Digite um nome para identificação no caixa"
                value={cashierIdent}
                onChange={e => setCashierIdent(e.target.value)}
              />
            </div>
             <div>
              <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block uppercase">Pedido de compra</label>
              <input 
                className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white disabled:bg-gray-50 dark:disabled:bg-slate-800" 
                value={purchaseOrder}
                onChange={e => setPurchaseOrder(e.target.value)}
                disabled={isCashierConfirming}
              />
            </div>
             <div>
              <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block uppercase">Vendedor</label>
              <div className="w-full border border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 rounded px-2 py-2 text-sm text-gray-700 dark:text-white uppercase flex justify-between items-center">
                <span>{user?.name}</span>
                <User size={14} className="text-gray-400 dark:text-gray-300" />
              </div>
            </div>
          </div>
          
          {/* FOOTER BUTTONS */}
          <div className="flex justify-end gap-4 mt-2">
            {!isCashierConfirming ? (
                <>
                    <button 
                    onClick={() => handleSubmitSale(true)}
                    className="bg-slate-500 hover:bg-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold py-3 px-6 rounded shadow uppercase text-sm w-full md:w-auto"
                    >
                    F8 - {editingSaleId ? 'Atualizar Orçamento' : 'Finalizar como Orçamento'}
                    </button>
                    <button 
                    onClick={() => handleSubmitSale(false)}
                    className="bg-amber-400 hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500 text-slate-900 dark:text-white font-bold py-3 px-6 rounded shadow uppercase text-sm w-full md:w-auto"
                    >
                    F4 - {editingSaleId ? 'Atualizar Venda' : 'Finalizar Pedido de Venda'}
                    </button>
                </>
            ) : (
                <button 
                  onClick={handleCashierFinalize}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded shadow uppercase text-sm w-full md:w-auto flex items-center justify-center animate-pulse"
                >
                  <CheckCircle size={18} className="mr-2"/> F4 - Confirmar Pagamento e Baixar
                </button>
            )}
          </div>

        </div>
      )}

      {/* --- MODALS --- */}
      
      {/* EDIT ITEM MODAL */}
      {editModalOpen && editItemData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden border dark:border-slate-700">
             <div className="bg-white dark:bg-slate-800 px-6 py-4 border-b border-gray-100 dark:border-slate-700">
                <h3 className="font-bold text-gray-800 dark:text-white uppercase">{editItemData.productName}</h3>
             </div>
             <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">R$ Unitário</label>
                    <input 
                       type="text" 
                       className="w-full border border-gray-300 dark:border-slate-600 rounded p-2 text-right bg-white dark:bg-slate-700 dark:text-white" 
                       value={editItemData.unitPrice ? formatMoney(editItemData.unitPrice) : ''}
                       onChange={e => setEditItemData({...editItemData, unitPrice: parseMoney(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Quantidade</label>
                    <input 
                       type="number" 
                       className="w-full border border-blue-300 ring-1 ring-blue-200 dark:border-blue-900 dark:ring-blue-900 rounded p-2 text-blue-600 dark:text-blue-400 font-bold text-center bg-white dark:bg-slate-700" 
                       value={editItemData.quantity}
                       onChange={e => setEditItemData({...editItemData, quantity: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Observação do item vendido</label>
                  <input 
                    className="w-full border border-gray-300 dark:border-slate-600 rounded p-2 text-sm bg-white dark:bg-slate-700 dark:text-white" 
                    placeholder="Máximo de 80 caracteres" 
                    maxLength={80}
                    value={editItemData.observation || ''}
                    onChange={e => setEditItemData({...editItemData, observation: e.target.value})}
                  />
                </div>
                <div className="border-t dark:border-slate-700 pt-4">
                  <div className="text-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">Total R$</span>
                    <div className="text-2xl font-bold text-gray-800 dark:text-white">
                      {formatMoney((editItemData.unitPrice || 0) * (editItemData.quantity || 0))}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={saveEditItem}
                  className="w-full bg-amber-400 hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500 text-slate-900 dark:text-white font-bold py-3 rounded uppercase text-sm"
                >
                  Confirmar
                </button>
             </div>
          </div>
        </div>
      )}

      {/* DISCOUNT MODAL */}
      {discountModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden border dark:border-slate-700">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 dark:text-white text-sm uppercase flex items-center">
                  <DollarSign size={16} className="mr-1" /> Desconto Pré-Autorizado
                </h3>
                <button onClick={() => setDiscountModalOpen(false)}><X size={20} className="text-gray-400 dark:text-gray-300" /></button>
              </div>
              <div className="p-6">
                 <div className="flex justify-between mb-6 text-sm">
                    <div className="space-y-1">
                      <div className="text-gray-500 dark:text-gray-400">PRODUTOS (ATUAL) <span className="text-gray-800 dark:text-white font-bold">R$ {formatMoney(subTotal)}</span></div>
                      <div className="text-gray-500 dark:text-gray-400">DESC. GLOBAL <span className="text-red-600 dark:text-red-400 font-bold">R$ {formatMoney(tempDiscountValue)}</span></div>
                      <div className="text-gray-800 dark:text-white font-bold pt-2 border-t dark:border-slate-700">A PAGAR R$ {formatMoney(subTotal - tempDiscountValue)}</div>
                      <div className="text-xs text-blue-500 dark:text-blue-400 pt-1">
                        % Total s/ Orig: {tempDiscountPercent.toFixed(2)}%
                      </div>
                    </div>
                    <div className="space-y-3 w-32">
                       <div>
                         <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">→ DESCONTO GLOBAL R$</label>
                         <input 
                           type="text" 
                           className="w-full border border-gray-300 dark:border-slate-600 rounded p-1 text-right text-sm bg-white dark:bg-slate-700 dark:text-white"
                           value={formatMoney(tempDiscountValue)}
                           onChange={e => handleDiscountValueChange(parseMoney(e.target.value))}
                         />
                       </div>
                       <div>
                         <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">→ % TOTAL (Item+Global)</label>
                         <input 
                           type="number" 
                           className="w-full border border-gray-300 dark:border-slate-600 rounded p-1 text-right text-sm bg-white dark:bg-slate-700 dark:text-white"
                           value={tempDiscountPercent.toFixed(2)}
                           onChange={e => handleDiscountPercentChange(parseFloat(e.target.value)||0)}
                         />
                       </div>
                       <div>
                         <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">→ TOTAL C/ DESC R$</label>
                         <input 
                           type="text" 
                           className="w-full border border-gray-300 dark:border-slate-600 rounded p-1 text-right text-sm font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-700"
                           value={formatMoney(subTotal - tempDiscountValue)}
                           onChange={e => handleDiscountTotalChange(parseMoney(e.target.value))}
                         />
                       </div>
                    </div>
                 </div>
                 
                 { (tempDiscountPercent > 6) && (
                   <div className="mb-6 bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-100 dark:border-red-900/30">
                      <label className="block text-xs font-bold text-red-600 dark:text-red-400 mb-1">Token Gerencial Obrigatório (> 6%)</label>
                      <input 
                        type="password" 
                        className="w-full border border-gray-300 dark:border-slate-600 rounded p-2 text-center bg-white dark:bg-slate-700 dark:text-white"
                        placeholder="******"
                        value={discountToken}
                        onChange={e => setDiscountToken(e.target.value)}
                      />
                   </div>
                 )}

                 <div className="space-y-2">
                    <button 
                      onClick={confirmDiscount}
                      className="w-full bg-amber-400 hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500 text-slate-900 dark:text-white font-bold py-2 rounded uppercase text-sm flex items-center justify-center"
                    >
                      <Check size={16} className="mr-2" /> Confirmar Desconto
                    </button>
                    <button 
                      onClick={() => setDiscountModalOpen(false)}
                      className="w-full bg-slate-500 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500 text-white font-bold py-2 rounded uppercase text-sm"
                    >
                      Cancelar
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* CANCEL SALE MODAL */}
      {cancelModalOpen && saleToCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden border dark:border-slate-700 animate-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Cancelar Venda #{saleToCancel.id}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Tem certeza que deseja cancelar esta venda? <br/>
                {saleToCancel.status === SaleStatus.COMPLETED && 
                  <span className="font-bold text-red-600 dark:text-red-400 block mt-2">
                    ATENÇÃO: O estoque dos produtos será estornado!
                  </span>
                }
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setCancelModalOpen(false)}
                  className="bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-white font-bold py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Voltar
                </button>
                <button 
                  onClick={executeCancelSale}
                  className="bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition-colors shadow-md"
                >
                  Confirmar Cancelamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW SALE DETAILS MODAL */}
      {viewModalOpen && saleToView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border dark:border-slate-700 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900">
              <div>
                 <h3 className="font-bold text-gray-800 dark:text-white text-lg">Detalhes da Venda #{saleToView.id}</h3>
                 <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(saleToView.createdAt).toLocaleString()}</div>
              </div>
              <button onClick={() => setViewModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status Header */}
              <div className="flex justify-between items-center bg-gray-100 dark:bg-slate-700/50 p-3 rounded-lg">
                 <div>
                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Status</div>
                    {saleToView.status === SaleStatus.COMPLETED && <span className="text-green-600 dark:text-green-400 font-bold flex items-center"><CheckCircle size={14} className="mr-1"/> CONCLUÍDA</span>}
                    {saleToView.status === SaleStatus.PENDING && <span className="text-orange-600 dark:text-orange-400 font-bold flex items-center"><Clock size={14} className="mr-1"/> PENDENTE</span>}
                    {saleToView.status === SaleStatus.BUDGET && <span className="text-gray-600 dark:text-gray-400 font-bold flex items-center"><FileText size={14} className="mr-1"/> ORÇAMENTO</span>}
                    {saleToView.status === SaleStatus.CANCELLED && <span className="text-red-600 dark:text-red-400 font-bold flex items-center"><XCircle size={14} className="mr-1"/> CANCELADA</span>}
                 </div>
                 <div className="text-right">
                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Total Geral</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">R$ {formatMoney(saleToView.totalValue)}</div>
                 </div>
              </div>

              {/* People Info */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 border border-gray-100 dark:border-slate-700 rounded bg-white dark:bg-slate-700/20">
                   <div className="text-xs text-gray-400 uppercase font-bold mb-1">Vendedor</div>
                   <div className="font-medium text-gray-800 dark:text-gray-200">{saleToView.sellerName}</div>
                </div>
                <div className="p-3 border border-gray-100 dark:border-slate-700 rounded bg-white dark:bg-slate-700/20">
                   <div className="text-xs text-gray-400 uppercase font-bold mb-1">Caixa</div>
                   <div className="font-medium text-gray-800 dark:text-gray-200">{saleToView.cashierName || '-'}</div>
                   <div className="text-xs text-gray-500">{saleToView.cashierIdent}</div>
                </div>
                <div className="p-3 border border-gray-100 dark:border-slate-700 rounded bg-white dark:bg-slate-700/20">
                   <div className="text-xs text-gray-400 uppercase font-bold mb-1">Cliente</div>
                   <div className="font-medium text-gray-800 dark:text-gray-200">{saleToView.clientName || 'Não identificado'}</div>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2 text-sm flex items-center"><Check size={14} className="mr-1"/> Itens do Pedido</h4>
                <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-2">Produto</th>
                        <th className="px-4 py-2 text-center">Qtde</th>
                        <th className="px-4 py-2 text-right">Vlr Unit</th>
                        <th className="px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                      {saleToView.items.map((item, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2">
                             <div className="font-medium text-gray-800 dark:text-gray-200">{item.productName}</div>
                             {item.observation && <div className="text-xs text-gray-400 italic">{item.observation}</div>}
                          </td>
                          <td className="px-4 py-2 text-center text-gray-600 dark:text-gray-400">{item.quantity} {item.unit}</td>
                          <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">{formatMoney(item.unitPrice)}</td>
                          <td className="px-4 py-2 text-right font-medium text-gray-800 dark:text-gray-200">{formatMoney(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financials & Payments Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                 {/* Payments */}
                 <div>
                    <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2 text-sm flex items-center"><CreditCard size={14} className="mr-1"/> Pagamentos</h4>
                    <div className="bg-gray-50 dark:bg-slate-700/30 p-3 rounded text-sm space-y-1">
                      {saleToView.payments && Object.entries(saleToView.payments).map(([key, value]) => {
                         if ((value as number) > 0) {
                           return (
                             <div key={key} className="flex justify-between text-gray-700 dark:text-gray-300">
                               <div className="flex items-center">
                                 <span className="uppercase text-xs font-bold text-gray-500 dark:text-gray-400 mr-2">{key}</span>
                                 {key === 'credit' && saleToView.installments && saleToView.installments > 1 && (
                                   <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">{saleToView.installments}x</span>
                                 )}
                               </div>
                               <span>R$ {formatMoney(value as number)}</span>
                             </div>
                           )
                         }
                         return null;
                      })}
                      {(!saleToView.payments || Object.values(saleToView.payments).every(v => v === 0)) && (
                        <div className="text-gray-400 italic text-xs">Nenhum pagamento registrado.</div>
                      )}
                    </div>
                 </div>

                 {/* Totals */}
                 <div>
                    <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2 text-sm flex items-center"><DollarSign size={14} className="mr-1"/> Resumo Financeiro</h4>
                    <div className="space-y-1 text-sm">
                       <div className="flex justify-between text-gray-600 dark:text-gray-400">
                          <span>Subtotal Itens:</span>
                          <span>R$ {formatMoney(saleToView.items.reduce((acc, i) => acc + i.total, 0))}</span>
                       </div>
                       {saleToView.discount ? (
                         <div className="flex justify-between text-red-600 dark:text-red-400">
                            <span>Descontos:</span>
                            <span>- R$ {formatMoney(saleToView.discount)}</span>
                         </div>
                       ) : null}
                       {saleToView.freight ? (
                         <div className="flex justify-between text-gray-600 dark:text-gray-400">
                            <span>Frete:</span>
                            <span>+ R$ {formatMoney(saleToView.freight)}</span>
                         </div>
                       ) : null}
                       {saleToView.otherCosts ? (
                         <div className="flex justify-between text-gray-600 dark:text-gray-400">
                            <span>Outros:</span>
                            <span>+ R$ {formatMoney(saleToView.otherCosts)}</span>
                         </div>
                       ) : null}
                       <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-slate-700 pt-2 mt-2 text-base">
                          <span>Total Geral:</span>
                          <span>R$ {formatMoney(saleToView.totalValue)}</span>
                       </div>
                    </div>
                 </div>
              </div>
              
              {/* Extra Info */}
              {(saleToView.observation || saleToView.deliveryAddress) && (
                 <div className="border-t border-gray-100 dark:border-slate-700 pt-4 text-sm text-gray-600 dark:text-gray-400">
                    {saleToView.deliveryAddress && (
                      <div className="mb-2">
                        <span className="font-bold text-xs uppercase block text-gray-400">Endereço de Entrega:</span>
                        {saleToView.deliveryAddress}
                      </div>
                    )}
                    {saleToView.observation && (
                      <div>
                        <span className="font-bold text-xs uppercase block text-gray-400">Observações:</span>
                        {saleToView.observation}
                      </div>
                    )}
                 </div>
              )}

            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex justify-end">
               <button 
                 onClick={() => setViewModalOpen(false)}
                 className="bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-white font-bold py-2 px-6 rounded transition-colors"
               >
                 Fechar
               </button>
            </div>
          </div>
        </div>
      )}


      {/* --- TAB: PENDING (CASHIER) --- */}
      {activeTab === 'pending' && isCashier && (
        <div className="grid gap-4 max-w-5xl mx-auto">
          {/* Filter PENDING sales only. BUDGET sales should not appear here. */}
          {sales.filter(s => s.status === SaleStatus.PENDING).length === 0 && (
             <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
               <Clock size={48} className="mx-auto text-gray-200 dark:text-gray-600 mb-4" />
               <p className="text-gray-500 dark:text-gray-400">Nenhuma venda pendente para processar.</p>
             </div>
          )}
          {sales.filter(s => s.status === SaleStatus.PENDING).map(sale => (
            <div key={sale.id} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-orange-100 dark:border-orange-900/30 flex flex-col md:flex-row justify-between items-center gap-4 transition-colors">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs px-2 py-1 rounded-full font-bold">PENDENTE</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{new Date(sale.createdAt).toLocaleString()}</span>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{sale.clientName || 'Cliente não identificado'}</span>
                </div>
                <div className="space-y-1 bg-gray-50 dark:bg-slate-700/50 p-3 rounded text-sm">
                  {/* LIMIT ITEMS TO 3 */}
                  {sale.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex justify-between border-b border-gray-100 dark:border-slate-600 last:border-0 pb-1 last:pb-0 text-gray-700 dark:text-gray-300">
                      <span>{item.quantity} {item.unit} x {item.productName}</span>
                      <span className="text-gray-600 dark:text-gray-400 font-mono">R$ {formatMoney(item.total)}</span>
                    </div>
                  ))}
                  {sale.items.length > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 italic pt-1">
                      + {sale.items.length - 3} itens...
                    </div>
                  )}
                  
                  {sale.discount && sale.discount > 0 && (
                    <div className="flex justify-between text-red-500 dark:text-red-400 text-xs pt-1 border-t border-dashed border-gray-200 dark:border-slate-600 mt-2">
                      <span>Desconto</span>
                      <span>- R$ {formatMoney(sale.discount)}</span>
                    </div>
                  )}
                   {sale.payments && (
                     <div className="mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-slate-600 text-xs text-gray-500 dark:text-gray-400">
                        <div>Pagamentos informados:</div>
                        {Object.entries(sale.payments).map(([key, val]) => (
                           (val as number) > 0 && <span key={key} className="mr-2 uppercase">{key}: {formatMoney(val as number)}</span>
                        ))}
                     </div>
                   )}
                </div>
                <div className="text-xs text-gray-400 mt-2">Vendedor: {sale.sellerName}</div>
              </div>
              <div className="text-right flex flex-col items-end gap-3 min-w-[200px]">
                <div className="text-2xl font-bold text-gray-800 dark:text-white">R$ {formatMoney(sale.totalValue)}</div>
                <button
                  onClick={() => handleCashierOpenSale(sale)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center justify-center shadow-sm font-bold transition-transform active:scale-95"
                >
                  <ArrowRight size={18} className="mr-2" /> ABRIR E CONFERIR
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- TAB: HISTORY --- */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden max-w-6xl mx-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-100 dark:border-slate-600">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">ID / Data</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Cliente</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Status</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Vendedor / Caixa</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Total</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {sales.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-xs font-mono text-gray-500 dark:text-gray-400">#{sale.id}</div>
                      <div className="text-sm text-gray-900 dark:text-white">{new Date(sale.createdAt).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{new Date(sale.createdAt).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-gray-200">
                      {sale.clientName || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {sale.status === SaleStatus.COMPLETED && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"><CheckCircle size={12} className="mr-1"/> Concluída</span>}
                      {sale.status === SaleStatus.PENDING && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400"><Clock size={12} className="mr-1"/> Pendente</span>}
                      {sale.status === SaleStatus.BUDGET && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300"><FileText size={12} className="mr-1"/> Orçamento</span>}
                      {sale.status === SaleStatus.CANCELLED && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"><XCircle size={12} className="mr-1"/> Cancelada</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      <div><span className="text-xs text-gray-400 dark:text-gray-500">Vend:</span> {sale.sellerName}</div>
                      {sale.cashierName && <div><span className="text-xs text-gray-400 dark:text-gray-500">Caixa:</span> {sale.cashierName}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">R$ {formatMoney(sale.totalValue)}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => handleViewSale(sale)}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                        title="Ver Detalhes"
                      >
                        <Eye size={18} />
                      </button>
                      {/* Edit Action - For Salesperson/Manager on non-completed/cancelled sales */}
                      {isSalesperson && sale.status !== SaleStatus.COMPLETED && sale.status !== SaleStatus.CANCELLED && (
                        <button
                          onClick={() => handleEditSale(sale)}
                          className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-900/50 px-3 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          Editar
                        </button>
                      )}
                      {/* Cancel Action - For Manager only */}
                      {isManager && sale.status !== SaleStatus.CANCELLED && (
                        <button
                          onClick={() => requestCancelSale(sale)}
                          className="inline-flex items-center text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 px-3 py-1 rounded transition-colors text-xs font-bold border border-red-200 dark:border-red-900/50"
                        >
                          <XCircle size={14} className="mr-1"/> Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
