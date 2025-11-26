import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Product, UserRole, UnitConfig } from '../types';
import { getProducts, saveProduct, deleteProduct, toggleProductActive, getUnits, toggleUnitActive } from '../services/mockBackend';
import { Plus, Edit2, Trash2, Search, Package, Power, AlertTriangle, Filter, Settings } from 'lucide-react';
import { useToast } from '../context/ToastContext';

// Helper functions for currency (duplicated for isolated component usage)
const formatMoney = (value: number) => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseMoney = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return parseInt(digits || "0") / 100;
};

export const Products: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<UnitConfig[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [unitsModalOpen, setUnitsModalOpen] = useState(false);
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    code: '', name: '', description: '', price: 0, stock: 0, category: '', unit: 'UNID', active: true
  });

  const isManager = user?.role === UserRole.MANAGER;

  const loadProducts = async () => {
    const data = await getProducts();
    setProducts(data);
  };

  const loadUnits = () => {
    const data = getUnits();
    setUnits(data);
  };

  useEffect(() => {
    loadProducts();
    loadUnits();
  }, []);

  // Extract unique categories for filter
  const categories = Array.from(new Set(products.map(p => p.category))).sort();

  const handleOpenModal = (product?: Product) => {
    // Refresh units when opening form
    loadUnits();
    
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({ code: '', name: '', description: '', price: 0, stock: 0, category: '', unit: 'UNID', active: true });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.price !== undefined) {
      await saveProduct(formData as Product);
      toast.success(editingProduct ? 'Produto atualizado!' : 'Produto cadastrado!');
      setIsModalOpen(false);
      loadProducts();
    }
  };

  // Delete Handlers
  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      await deleteProduct(productToDelete.id);
      toast.success("Produto excluído com sucesso.");
      setDeleteModalOpen(false);
      setProductToDelete(null);
      loadProducts();
    }
  };

  // Active Toggle Handler
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await toggleProductActive(id);
      toast.info(currentStatus ? "Produto desativado." : "Produto ativado.");
      loadProducts();
    } catch (e) {
      toast.error("Erro ao alterar status.");
    }
  };

  // Units Management
  const handleToggleUnit = (code: string) => {
    const newUnits = toggleUnitActive(code);
    setUnits(newUnits);
  };

  // Filter Logic
  const filteredProducts = products.filter(p => {
    // 1. Search Term
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 2. Status Filter
    let matchesStatus = true;
    if (statusFilter === 'active') matchesStatus = p.active === true;
    if (statusFilter === 'inactive') matchesStatus = p.active === false;
    
    // 3. Category Filter
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
          <Package className="mr-2" /> Catálogo de Produtos
        </h1>
        {isManager && (
          <div className="flex gap-2">
            <button 
              onClick={() => setUnitsModalOpen(true)}
              className="bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 flex items-center shadow-sm transition-colors"
              title="Configurar Unidades"
            >
              <Settings size={18} />
            </button>
            <button 
              onClick={() => handleOpenModal()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center shadow-md transition-colors"
            >
              <Plus size={18} className="mr-2" /> Novo Produto
            </button>
          </div>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou código..." 
            className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 dark:text-white transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-4">
          <div className="relative min-w-[150px]">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
               <Filter size={16} />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full pl-9 pr-4 py-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 dark:text-white appearance-none cursor-pointer"
            >
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="all">Todos</option>
            </select>
          </div>

          <div className="relative min-w-[180px]">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 dark:text-white appearance-none cursor-pointer"
            >
              <option value="all">Todas Categorias</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-100 dark:border-slate-600">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-sm">Status</th>
                <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-sm">Código</th>
                <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-sm">Produto</th>
                <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-sm">Categoria</th>
                <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-sm">Preço</th>
                <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-sm">Estoque</th>
                {isManager && <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-sm text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filteredProducts.map(product => (
                <tr key={product.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${!product.active ? 'opacity-60 bg-gray-50 dark:bg-slate-800/50' : ''}`}>
                  <td className="px-6 py-4">
                     <div className="flex items-center">
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${product.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{product.active ? 'Ativo' : 'Inativo'}</span>
                     </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-mono">{product.code}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{product.description}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{product.category}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-green-400">
                    R$ {formatMoney(product.price)}
                    <span className="text-gray-400 text-xs font-normal ml-1">/ {product.unit || 'UNID'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      product.stock > 10 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {product.stock} {product.unit || 'UNID'}
                    </span>
                  </td>
                  {isManager && (
                    <td className="px-6 py-4 text-right space-x-2">
                       <button 
                        onClick={() => handleToggleActive(product.id, product.active)}
                        className={`p-1 rounded transition-colors ${product.active ? 'text-green-600 hover:text-green-800 dark:text-green-400' : 'text-gray-400 hover:text-gray-600'}`}
                        title={product.active ? "Desativar Produto" : "Ativar Produto"}
                      >
                        <Power size={18} />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(product)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(product)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                    Nenhum produto encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden border dark:border-slate-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Código</label>
                  <input type="text" required className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-white" 
                    value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria</label>
                  <input type="text" required className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-white" 
                    value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
                <input type="text" required className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-white" 
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                <textarea className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-white" rows={2}
                  value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preço (R$)</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-right bg-white dark:bg-slate-700 dark:text-white" 
                    value={formData.price !== undefined ? formatMoney(formData.price) : ''} 
                    onChange={e => setFormData({...formData, price: parseMoney(e.target.value)})} 
                  />
                </div>
                 <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidade</label>
                  <select 
                    required 
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-white"
                    value={formData.unit || 'UNID'}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                  >
                    {units.filter(u => u.active || u.code === formData.unit).map(u => (
                      <option key={u.code} value={u.code}>{u.code} - {u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estoque</label>
                  <input type="number" required className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-white" 
                    value={formData.stock} onChange={e => setFormData({...formData, stock: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Units Management Modal */}
      {unitsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm overflow-hidden border dark:border-slate-700">
             <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Unidades de Medida</h3>
              <button onClick={() => setUnitsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
               <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Selecione as unidades que deseja utilizar no sistema:</p>
               <div className="space-y-3">
                 {units.map(unit => (
                   <div key={unit.code} className="flex items-center justify-between p-2 border border-gray-100 dark:border-slate-700 rounded bg-gray-50 dark:bg-slate-700/50">
                     <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                       <span className="font-bold w-12 inline-block">{unit.code}</span> - {unit.name}
                     </span>
                     <button 
                       onClick={() => handleToggleUnit(unit.code)}
                       className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${unit.active ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                     >
                       <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${unit.active ? 'translate-x-4' : 'translate-x-0'}`}></div>
                     </button>
                   </div>
                 ))}
               </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700 text-right">
              <button onClick={() => setUnitsModalOpen(false)} className="text-sm text-blue-600 font-bold hover:underline">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && productToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden border dark:border-slate-700 animate-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Excluir Produto</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Tem certeza que deseja excluir permanentemente o produto <strong>{productToDelete.name}</strong>?
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setDeleteModalOpen(false)}
                  className="bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-white font-bold py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition-colors shadow-md"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};