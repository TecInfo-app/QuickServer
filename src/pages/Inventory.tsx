import React, { useState, useEffect } from 'react';
import { Package, Search, Filter, Download, Edit2, Trash2, PlusCircle, Save, Copy, Upload, Database, ChevronDown, ChevronUp } from 'lucide-react';
import { getStoredInventory, saveInventory, Product } from '../utils/db';
import AlertModal from '../components/ui/AlertModal';

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  
  const [categories, setCategories] = useState<string[]>([
    'Lanches',
    'Bebidas',
    'Sobremesas',
    'Pratos Principais',
    'Petiscos'
  ]);
  const [newCatName, setNewCatName] = useState('');
  const [showAddCatInput, setShowAddCatInput] = useState(false);
  const [alertState, setAlertState] = useState<{isOpen: boolean, title: string, message: string, onConfirm?: () => void}>({isOpen: false, title: '', message: ''});

  // Form states
  const [formData, setFormData] = useState({
    id: 0,
    name: '',
    category: 'Lanches',
    stock: 10,
    cost: 0,
    price: 0,
    isCombo: false,
    minComplements: 0,
    maxComplements: 5,
    comboGroupCode: '',
    parentGroupCode: '',
    pdvCode: '',
    isQuickTouch: false,
    image: ''
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const loadInventory = () => {
      const stored = getStoredInventory();
      setProducts(stored);
      
      // Extract unique categories from stored products and merge
      const defaultCats = ['Lanches', 'Bebidas', 'Sobremesas', 'Pratos Principais', 'Petiscos'];
      const storedCats = Array.from(new Set(stored.map(p => p.category).filter(Boolean)));
      const merged = Array.from(new Set([...defaultCats, ...storedCats]));
      setCategories(merged);
    };

    loadInventory();

    window.addEventListener('qsp_database_updated', loadInventory);
    return () => window.removeEventListener('qsp_database_updated', loadInventory);
  }, []);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      setAlertState({ isOpen: true, title: 'Aviso', message: 'Esta categoria já existe!' });
      return;
    }
    const updated = [...categories, trimmed];
    setCategories(updated);
    setFormData(prev => ({ ...prev, category: trimmed }));
    setNewCatName('');
    setShowAddCatInput(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setAlertState({ isOpen: true, title: 'Aviso', message: 'Por favor, digite o nome do produto.' });
      return;
    }
    if (formData.price <= 0) {
      setAlertState({ isOpen: true, title: 'Aviso', message: 'O preço de venda deve ser maior do que zero.' });
      return;
    }
    if (formData.isQuickTouch && !formData.image) {
      setAlertState({ isOpen: true, title: 'Aviso', message: 'A foto do produto é obrigatória para venda no balcão / QuickTouch!' });
      return;
    }

    let updatedList: Product[];

    if (isEditing) {
      updatedList = products.map(p => p.id === formData.id ? {
        ...p,
        name: formData.name,
        category: formData.category,
        stock: Number(formData.stock),
        cost: Number(formData.cost),
        price: Number(formData.price),
        isCombo: formData.isCombo,
        minComplements: Number(formData.minComplements) || 0,
        maxComplements: Number(formData.maxComplements) || 0,
        comboGroupCode: formData.comboGroupCode || '',
        parentGroupCode: formData.parentGroupCode || '',
        pdvCode: formData.pdvCode || '',
        isQuickTouch: formData.isQuickTouch,
        image: formData.image || '',
        isLow: Number(formData.stock) <= 10
      } : p);
      setAlertState({ isOpen: true, title: 'Sucesso', message: 'Produto atualizado com sucesso!' });
    } else {
      const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
      const newProduct: Product = {
        id: newId,
        name: formData.name,
        category: formData.category,
        stock: Number(formData.stock),
        cost: Number(formData.cost),
        price: Number(formData.price),
        isCombo: formData.isCombo,
        minComplements: Number(formData.minComplements) || 0,
        maxComplements: Number(formData.maxComplements) || 0,
        comboGroupCode: formData.comboGroupCode || '',
        parentGroupCode: formData.parentGroupCode || '',
        pdvCode: formData.pdvCode || '',
        isQuickTouch: formData.isQuickTouch,
        image: formData.image || '',
        isLow: Number(formData.stock) <= 10
      };
      updatedList = [newProduct, ...products];
      setAlertState({ isOpen: true, title: 'Sucesso', message: 'Novo produto cadastrado com sucesso!' });
    }

    setProducts(updatedList);
    saveInventory(updatedList);
    handleReset();
  };

  const handleEdit = (product: Product) => {
    setFormData({
      id: product.id,
      name: product.name,
      category: product.category,
      stock: product.stock,
      cost: product.cost,
      price: product.price,
      isCombo: !!product.isCombo,
      minComplements: product.minComplements || 0,
      maxComplements: product.maxComplements || 0,
      comboGroupCode: product.comboGroupCode || '',
      parentGroupCode: product.parentGroupCode || '',
      pdvCode: product.pdvCode || '',
      isQuickTouch: !!product.isQuickTouch,
      image: product.image || ''
    });
    setIsEditing(true);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReplicate = (product: Product) => {
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    const duplicatedProduct: Product = {
      ...product,
      id: newId,
      name: `${product.name} (Cópia)`,
    };
    const updatedList = [duplicatedProduct, ...products];
    setProducts(updatedList);
    saveInventory(updatedList);
    setAlertState({ isOpen: true, title: 'Sucesso', message: `Produto "${product.name}" replicado como "${duplicatedProduct.name}" com sucesso!` });
  };

  const handleBackupMenu = () => {
    try {
      const dataStr = JSON.stringify(products, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_cardapio_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setAlertState({ isOpen: true, title: 'Erro', message: 'Erro ao gerar backup do cardápio.' });
    }
  };

  const handleRestoreMenu = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          const isValid = json.every(p => p && typeof p === 'object' && 'name' in p && 'price' in p);
          if (!isValid) {
            setAlertState({ isOpen: true, title: 'Erro', message: 'O arquivo selecionado não contém um formato de cardápio válido.' });
            return;
          }

          setAlertState({
            isOpen: true,
            title: 'Aviso',
            message: `Deseja realmente restaurar o cardápio? Isso irá substituir os ${products.length} itens atuais por ${json.length} itens do backup.`,
            onConfirm: () => {
              setProducts(json);
              saveInventory(json);

              // Extract and update categories dynamically
              const defaultCats = ['Lanches', 'Bebidas', 'Sobremesas', 'Pratos Principais', 'Petiscos'];
              const uniqueCats = Array.from(new Set(json.map((p: any) => p.category).filter(Boolean))) as string[];
              const merged = Array.from(new Set([...defaultCats, ...uniqueCats]));
              setCategories(merged);

              setAlertState({ isOpen: true, title: 'Sucesso', message: 'Cardápio restaurado com sucesso!' });
            }
          });
        } else {
          setAlertState({ isOpen: true, title: 'Erro', message: 'O arquivo selecionado não é um backup de cardápio válido.' });
        }
      } catch (err) {
        setAlertState({ isOpen: true, title: 'Erro', message: 'Erro ao ler ou processar o arquivo de backup.' });
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleDelete = (id: number) => {
    setAlertState({
      isOpen: true,
      title: 'Aviso',
      message: 'Deseja realmente excluir este produto?',
      onConfirm: () => {
        const updatedList = products.filter(p => p.id !== id);
        setProducts(updatedList);
        saveInventory(updatedList);
      }
    });
  };

  const handleReset = () => {
    setFormData({
      id: 0,
      name: '',
      category: categories[0] || 'Lanches',
      stock: 10,
      cost: 0,
      price: 0,
      isCombo: false,
      minComplements: 0,
      maxComplements: 5,
      comboGroupCode: '',
      parentGroupCode: '',
      pdvCode: '',
      isQuickTouch: false,
      image: ''
    });
    setIsEditing(false);
    setShowForm(false);
  };

  const handleExport = () => {
    // Generate CSV mockup download
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["ID,Nome,Categoria,Estoque,Preço Custo,Preço Venda"].join(",") + "\n"
      + products.map(p => `${p.id},"${p.name}",${p.category},${p.stock},${p.cost},${p.price}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "estoque_pos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setAlertState({ isOpen: true, title: 'Sucesso', message: 'Relatório de inventário exportado para excel/estoque_pos.csv!' });
  };

  const handleFilterLowStock = () => {
    const lowCount = products.filter(p => p.stock <= 10).length;
    setAlertState({ isOpen: true, title: 'Aviso', message: `Há ${lowCount} produtos com estoque igual ou menor a 10 unidades.` });
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="md:pb-12 space-y-8">
      {/* Page Title & Stats Brief */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-4">
        <div>
          <h2 className="text-headline-lg text-on-surface">Cadastro de Produtos e Estoque</h2>
          <p className="text-caption text-on-surface-variant">Adicione novos itens no cardápio e gerencie os níveis de estoque.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-outline-variant flex items-center gap-3">
            <div className="bg-primary-fixed p-2 rounded-lg text-primary">
              <Package size={24} />
            </div>
            <div>
              <p className="text-[12px] uppercase font-bold text-on-surface-variant">Variedade de Itens</p>
              <p className="text-stat-value text-[20px] leading-tight font-extrabold">{products.length} Cadastrados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Section: Add/Edit Product */}
      <section className="bg-surface-container-lowest rounded-[24px] p-6 card-shadow border border-surface-variant/20 shadow-sm transition-all duration-300">
        <button 
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="w-full flex items-center justify-between text-left text-primary transition-all focus:outline-none group select-none cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <PlusCircle size={24} className="text-brand-primary" />
            <div>
              <h3 className="text-headline-md font-extrabold text-on-surface flex items-center gap-2">
                {isEditing ? 'Editar Produto' : 'Novo Produto'}
                {!showForm && <span className="text-xs font-semibold px-2.5 py-1 rounded bg-brand-primary/10 text-brand-primary animate-pulse ml-2">Clique para abrir</span>}
              </h3>
              <p className="text-caption text-on-surface-variant mt-0.5">
                {isEditing 
                  ? `Editando o produto "${formData.name}"` 
                  : 'Abra este painel para cadastrar um novo produto ou associar complementos'
                }
              </p>
            </div>
          </div>
          <div className="bg-surface-container hover:bg-surface-variant p-2 rounded-xl text-on-surface-variant transition-colors">
            {showForm ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </div>
        </button>

        {showForm && (
          <div className="mt-6 pt-6 border-t border-surface-variant/30 animate-in fade-in slide-in-from-top-1">
            <form className="grid grid-cols-1 md:grid-cols-12 gap-6" onSubmit={handleSave}>
          <div className="md:col-span-5 flex flex-col gap-2">
            <label className="text-caption font-bold text-on-surface-variant ml-1" htmlFor="prodName">Nome do Produto</label>
            <input 
              id="prodName"
              type="text" 
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Ex: Hambúrguer Costela"
              className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary/50 outline-none transition-all placeholder:text-on-surface-variant/50 text-on-surface"
              required
            />
          </div>

          <div className="md:col-span-3 flex flex-col gap-2">
            <label className="text-caption font-bold text-on-surface-variant ml-1" htmlFor="prodPdvCode">Código PDV</label>
            <input 
              id="prodPdvCode"
              type="text" 
              value={formData.pdvCode}
              onChange={(e) => handleInputChange('pdvCode', e.target.value)}
              placeholder="Ex: 502"
              className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary/50 outline-none transition-all placeholder:text-on-surface-variant/50 text-on-surface"
            />
          </div>

          <div className="md:col-span-4 flex flex-col gap-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-caption font-bold text-on-surface-variant" htmlFor="prodCategory">Categoria</label>
              <button 
                type="button" 
                onClick={() => setShowAddCatInput(!showAddCatInput)}
                className="text-xs text-primary hover:underline font-bold"
              >
                {showAddCatInput ? 'Cancelar' : '+ Criar Nova'}
              </button>
            </div>
            {showAddCatInput ? (
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Nova categoria"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-grow h-12 px-3 rounded-xl border border-outline-variant text-on-surface text-sm outline-none bg-surface-container-lowest"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="px-4 h-12 bg-primary text-on-primary rounded-xl font-bold text-xs hover:brightness-95 select-none active:scale-95 transition-transform shrink-0"
                >
                  Criar
                </button>
              </div>
            ) : (
              <select
                id="prodCategory"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary/50 outline-none transition-all text-on-surface bg-surface-container-lowest"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>

          <div className="md:col-span-4 flex flex-col gap-2">
            <label className="text-caption font-bold text-on-surface-variant ml-1" htmlFor="prodStock">Estoque Qtd. Inicial</label>
            <input 
              id="prodStock"
              type="number" 
              value={formData.stock}
              onChange={(e) => handleInputChange('stock', e.target.value)}
              placeholder="10"
              className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary/50 outline-none transition-all text-on-surface"
              min="0"
              required
            />
          </div>

          <div className="md:col-span-4 flex flex-col gap-2">
            <label className="text-caption font-bold text-on-surface-variant ml-1" htmlFor="prodCost">Preço de Custo (R$)</label>
            <input 
              id="prodCost"
              type="number" 
              step="0.01"
              value={formData.cost || ''}
              onChange={(e) => handleInputChange('cost', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary/50 outline-none transition-all text-on-surface"
              min="0"
            />
          </div>

          <div className="md:col-span-4 flex flex-col gap-2">
            <label className="text-caption font-bold text-on-surface-variant ml-1" htmlFor="prodPrice">Preço de Venda (R$)</label>
            <input 
              id="prodPrice"
              type="number" 
              step="0.01"
              value={formData.price || ''}
              onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full h-12 px-4 rounded-xl border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary/50 outline-none transition-all text-on-surface"
              min="0.01"
              required
            />
          </div>

          {/* COMBINED ITEMS & COMPLEMENTS ASSOCIATION OPTIONS */}
          <div className="md:col-span-12 border-t border-surface-variant/30 pt-5 mt-3">
            <h4 className="text-body-medium font-bold text-primary mb-3 flex items-center gap-2">
              <span className="text-base">🍔 Configurações de Item Combinado e Complementos (Combos / Acompanhamentos)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-surface-container-low/60 p-5 rounded-[18px] border border-outline-variant/40">
              
              {/* Option 1: Is this a combined item? */}
              <div className="md:col-span-12 lg:col-span-4 flex flex-col gap-2 justify-center">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={formData.isCombo}
                    onChange={(e) => handleInputChange('isCombo', e.target.checked)}
                    className="w-5 h-5 accent-secondary border-outline-variant rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-body-lg font-bold text-on-surface">Este é um Item Combinado?</span>
                    <p className="text-caption text-on-surface-variant leading-tight">Se ativado, abrirá a seleção opcional de acompanhamentos/complementos ao vendê-lo.</p>
                  </div>
                </label>
              </div>

              {/* Only show min/max/group settings if marked as combined */}
              {formData.isCombo && (
                <>
                  <div className="md:col-span-3 flex flex-col gap-2">
                    <label className="text-caption font-bold text-on-surface-variant ml-1" htmlFor="minComp">Mín. Complementos</label>
                    <input 
                      id="minComp"
                      type="number"
                      value={formData.minComplements}
                      onChange={(e) => handleInputChange('minComplements', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface outline-none"
                      min="0"
                    />
                  </div>
                  <div className="md:col-span-3 flex flex-col gap-2">
                    <label className="text-caption font-bold text-on-surface-variant ml-1" htmlFor="maxComp">Máx. Complementos</label>
                    <input 
                      id="maxComp"
                      type="number"
                      value={formData.maxComplements}
                      onChange={(e) => handleInputChange('maxComplements', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface outline-none"
                      min="1"
                    />
                  </div>
                  <div className="md:col-span-6 flex flex-col gap-1">
                    <label className="text-caption font-bold text-on-surface-variant ml-1" htmlFor="comboGrpCode">Código do Grupo de Associação</label>
                    <input 
                      id="comboGrpCode"
                      type="text"
                      placeholder="Ex: 10"
                      value={formData.comboGroupCode}
                      onChange={(e) => handleInputChange('comboGroupCode', e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 outline-none"
                    />
                    <span className="text-[10px] text-on-surface-variant mt-0.5 ml-1">Associe outros produtos a este mesmo código abaixo para que apareçam como opções deste item principal.</span>
                  </div>
                </>
              )}

              {/* Always show Parent group code so any item can reference the main combo */}
              <div className="md:col-span-12 border-t border-dashed border-outline-variant/60 pt-4 mt-2 grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6 flex flex-col gap-2">
                  <label className="text-caption font-bold text-on-surface-variant ml-1" htmlFor="parentGrpCode">Pertence ao Grupo Combinado (Código Principal / Pai)</label>
                  <input 
                    id="parentGrpCode"
                    type="text"
                    placeholder="Ex: 10"
                    value={formData.parentGroupCode}
                    onChange={(e) => handleInputChange('parentGroupCode', e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 outline-none"
                  />
                </div>
                <div className="md:col-span-6 flex flex-col justify-center">
                  <p className="text-caption text-on-surface-variant leading-relaxed">
                    Insira aqui o número referente ao item principal (ex: <strong className="text-secondary font-bold">10</strong>).
                    <br />
                    • Se este produto for um acompanhamento livre/adicional, ele aparecerá para seleção nos itens com o código 10.
                    <br />
                    • Se este produto NÃO estiver marcado como combinado acima, mas possuir o código cadastrado, ao vendê-lo o sistema abrirá o modal para que o operador monte os acompanhamentos pertencentes ao grupo 10!
                  </p>
                </div>
            </div>
          </div>
        </div>

          {/* QUICKTOUCH SELF-SERVICE SETTINGS */}
          <div className="md:col-span-12 border-t border-surface-variant/30 pt-5 mt-3">
            <h4 className="text-body-medium font-bold text-primary mb-3 flex items-center gap-2">
              <span className="text-base">✨ Canal de Autoatendimento (Venda no Balcão / QuickTouch)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-surface-container-low/60 p-5 rounded-[18px] border border-outline-variant/40">
              
              <div className="md:col-span-12 lg:col-span-4 flex flex-col gap-2 justify-center">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={formData.isQuickTouch}
                    onChange={(e) => handleInputChange('isQuickTouch', e.target.checked)}
                    className="w-5 h-5 accent-secondary border-outline-variant rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-body-lg font-bold text-on-surface">Venda no Balcão (QuickTouch)?</span>
                    <p className="text-caption text-on-surface-variant leading-tight">Se ativado, o produto ficará visível de forma destacada no totem de autoatendimento para compras rápidas pelo cliente.</p>
                  </div>
                </label>
              </div>

              <div className="md:col-span-12 lg:col-span-8 flex flex-col gap-2">
                <label className="text-caption font-bold text-on-surface-variant ml-1" htmlFor="prodImage">
                  URL da Foto do Produto {formData.isQuickTouch && <span className="text-error font-bold">(Obrigatório para QuickTouch)</span>}
                </label>
                <div className="flex gap-2">
                  <input 
                    id="prodImage"
                    type="text"
                    placeholder="https://exemplo.com/comida.jpg"
                    value={formData.image || ''}
                    onChange={(e) => handleInputChange('image', e.target.value)}
                    className="flex-1 h-11 px-4 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50"
                  />
                </div>
                
                {/* Image presets */}
                <div className="mt-2 text-xs">
                  <span className="text-on-surface-variant font-medium mr-2">Fotos Prontas (Copiar exemplo):</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {[
                      { label: '🍔 Burguer', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80' },
                      { label: '🍕 Pizza', url: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80' },
                      { label: '🍟 Batata', url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80' },
                      { label: '🥤 Bebida', url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80' },
                      { label: '🍰 Petit Gateau', url: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80' }
                    ].map((p, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => handleInputChange('image', p.url)}
                        className="px-2 py-1 bg-surface-container rounded-lg border border-outline-variant/40 hover:bg-surface-variant hover:text-on-surface text-[11px] font-semibold text-on-surface-variant transition-colors cursor-pointer"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
          
          <div className="md:col-span-12 flex justify-end gap-3 mt-2">
            <button 
              type="button" 
              onClick={handleReset}
              className="px-6 py-3 rounded-xl font-bold text-on-surface-variant hover:bg-surface-variant transition-colors"
            >
              Cancelar/Limpar
            </button>
            <button 
              type="submit" 
              className="bg-brand-primary text-on-primary px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:brightness-95 active:scale-95 transition-all text-sm uppercase tracking-wider"
            >
              <Save size={20} />
              {isEditing ? 'Salvar Edições' : 'Salvar Produto'}
            </button>
          </div>
        </form>
          </div>
        )}
      </section>

      {/* List Section: Inventory */}
      <section className="bg-surface-container-lowest rounded-[24px] overflow-hidden card-shadow border border-surface-variant/20 shadow-sm">
        {/* Search & Filters */}
        <div className="p-6 border-b border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low/40">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-3.5 text-on-surface-variant" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-secondary/20 outline-none transition-all placeholder:text-on-surface-variant/50 text-body-lg text-on-surface border"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              type="button"
              onClick={handleFilterLowStock} 
              className="flex items-center gap-2 px-4 py-2.5 border border-outline-variant rounded-lg text-on-surface-variant hover:bg-surface-variant transition-all font-semibold text-sm cursor-pointer"
            >
              <Filter size={20} />
              Estoque Crítico
            </button>
            <button 
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 border border-outline-variant rounded-lg text-on-surface-variant hover:bg-surface-variant transition-all font-semibold text-sm cursor-pointer"
            >
              <Download size={20} />
              Exportar CSV
            </button>
            <button 
              type="button"
              onClick={handleBackupMenu}
              className="flex items-center gap-2 px-4 py-2.5 border border-outline-variant rounded-lg text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/15 transition-all font-semibold text-sm cursor-pointer"
              title="Baixar Backup do Cardápio completo (.json)"
            >
              <Database size={20} />
              Backup JSON
            </button>
            <label 
              className="flex items-center gap-2 px-4 py-2.5 border border-outline-variant rounded-lg text-brand-secondary bg-brand-secondary/10 hover:bg-brand-secondary/15 transition-all font-semibold text-sm cursor-pointer select-none"
              title="Restaurar Cardápio de Backup salvo (.json)"
            >
              <Upload size={20} />
              Restaurar Backup
              <input 
                type="file" 
                accept=".json" 
                onChange={handleRestoreMenu} 
                className="hidden" 
              />
            </label>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-surface-container text-left border-b border-outline-variant">
                <th className="px-6 py-4 text-caption font-bold text-on-surface-variant">PRODUTO</th>
                <th className="px-6 py-4 text-caption font-bold text-on-surface-variant">ESTOQUE ATUAL</th>
                <th className="px-6 py-4 text-caption font-bold text-on-surface-variant">CUSTO</th>
                <th className="px-6 py-4 text-caption font-bold text-on-surface-variant">PREÇO VENDA</th>
                <th className="px-6 py-4 text-caption font-bold text-on-surface-variant text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-surface-alt transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary">
                        <Package size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-on-surface">{product.name}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                          <span className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">Categoria: {product.category}</span>
                          {product.pdvCode && (
                            <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/45 dark:text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                              PDV: {product.pdvCode}
                            </span>
                          )}
                          {product.isCombo && (
                            <span className="bg-brand-primary/10 text-brand-primary text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                              ★ Combinado (Grupo {product.comboGroupCode || 'Sem Código'})
                            </span>
                          )}
                          {product.parentGroupCode && (
                            <span className="bg-brand-secondary/10 text-brand-secondary text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                              ↳ Complemento (Grupo {product.parentGroupCode})
                            </span>
                          )}
                          {product.isQuickTouch && (
                            <span className="bg-teal-500/10 text-teal-600 dark:text-teal-300 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase flex items-center gap-1">
                              ⚡ QuickTouch {product.image ? '📸' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 rounded-full font-bold text-[13px] ${product.stock <= 10 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                      {product.stock} unidades {product.stock <= 10 && '(Baixo)'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">R$ {product.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 font-bold text-on-surface">R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleReplicate(product)}
                        className="p-2 text-primary hover:bg-primary-container/20 rounded-lg transition-colors cursor-pointer" 
                        title="Replicar Produto"
                      >
                        <Copy size={20} />
                      </button>
                      <button 
                        onClick={() => handleEdit(product)}
                        className="p-2 text-secondary hover:bg-secondary-container/20 rounded-lg transition-colors cursor-pointer" 
                        title="Editar"
                      >
                        <Edit2 size={20} />
                      </button>
                      <button 
                        onClick={() => handleDelete(product.id)}
                        className="p-2 text-error hover:bg-error-container/20 rounded-lg transition-colors cursor-pointer" 
                        title="Excluir"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-on-surface-variant">
                    Nenhum produto cadastrado encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Status indicator counter */}
        <div className="p-6 bg-surface-container-low flex items-center justify-between border-t border-outline-variant text-on-surface-variant">
          <span className="text-caption">Mostrando {filteredProducts.length} de {products.length} produtos cadastrados</span>
        </div>
      </section>

      <AlertModal 
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        onConfirm={alertState.onConfirm}
        onClose={() => setAlertState({ isOpen: false, title: '', message: '', onConfirm: undefined })}
      />
    </div>
  );
}
