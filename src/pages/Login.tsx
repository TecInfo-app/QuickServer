import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, LogIn, Info, Loader2 } from 'lucide-react';
import { getStoredUsers, setCurrentUser, getStoredStores, getAuthEmail, registerUserInFirebaseAuth } from '../utils/db';
import { auth } from '../utils/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import AlertModal from '../components/ui/AlertModal';

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const triggerAlert = (msg: string) => {
    setAlertMessage(msg);
    setIsAlertModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimUser = username.trim();
    const trimPass = password;

    if (!trimUser || !trimPass) {
      triggerAlert('Por favor, preencha o usuário e a senha.');
      return;
    }

    // 1. Central SaaS Super-Admin Check
    if (trimUser.toLowerCase() === 'admin' && trimPass === 'admin') {
      const centralAdminUser = {
        id: 999,
        name: 'Administrador Central Sênior',
        role: 'CentralAdmin',
        meta: 'SaaS SysOwner',
        active: true,
        permissions: ['/central-admin']
      };
      setCurrentUser(centralAdminUser);
      navigate('/central-admin');
      return;
    }

    setIsLoggingIn(true);
    try {
      // Get the correct Firebase Auth email mapping for this login attempt
      const activeStoreId = localStorage.getItem('active_store_id');
      const authEmail = getAuthEmail(trimUser, activeStoreId);

      // Try logging in using Firebase Authentication!
      let authUserCredential = null;
      try {
        authUserCredential = await signInWithEmailAndPassword(auth, authEmail, trimPass);
        console.log("Firebase Auth login successful:", authUserCredential.user.email);
      } catch (authError: any) {
        console.warn("Firebase Auth login failed, trying fallback to local/Firestore check...", authError);
      }

      // 2. Client Store Master Login Check (registered stores)
      const stores = getStoredStores();
      const foundStore = stores.find(
        s => s.email.toLowerCase() === trimUser.toLowerCase() && s.password === trimPass
      );

      if (foundStore) {
        if (foundStore.status === 'SUSPENDED') {
          triggerAlert('Seu estabelecimento está suspenso no painel central. Por favor, regularize sua assinatura.');
          return;
        }
        
        // Select active tenant context
        localStorage.setItem('active_store_id', foundStore.id);
        
        // Seed default admin in users of that store if empty
        const defaultStoreAdmin = {
          id: 100,
          name: foundStore.ownerName,
          password: foundStore.password,
          role: 'Gerente',
          meta: 'Proprietário',
          active: true,
          permissions: ['/dashboard', '/tables', '/inventory', '/kiosk', '/reports', '/admin']
        };

        // If the Firebase Auth login was not completed, auto-register this account on the fly!
        if (!authUserCredential) {
          await registerUserInFirebaseAuth(foundStore.email, foundStore.password, foundStore.id);
          await registerUserInFirebaseAuth(foundStore.ownerName, foundStore.password, foundStore.id);
          // Try to sign in again after auto-registration
          try {
            await signInWithEmailAndPassword(auth, authEmail, trimPass);
          } catch (e) {
            console.error("Post-registration login failed:", e);
          }
        }

        setCurrentUser(defaultStoreAdmin);
        navigate('/dashboard');
        return;
      }

      // 3. Store Employee Login Check (prefixed by active store)
      const currentActiveStoreId = localStorage.getItem('active_store_id');
      if (currentActiveStoreId) {
        const activeStore = getStoredStores().find(s => s.id === currentActiveStoreId);
        if (activeStore && activeStore.status === 'SUSPENDED') {
          triggerAlert('Seu estabelecimento correspondente está suspenso no painel central. Por favor, regularize sua assinatura com o Administrador.');
          return;
        }
      }

      const employees = getStoredUsers();
      const foundEmployee = employees.find(
        u => u.name.toLowerCase() === trimUser.toLowerCase() && u.password === trimPass
      );

      if (foundEmployee) {
        if (!foundEmployee.active) {
          triggerAlert('Seu cadastro de funcionário está desativado no momento.');
          return;
        }

        // If the Firebase Auth login was not completed, auto-register this account on the fly!
        if (!authUserCredential && currentActiveStoreId) {
          await registerUserInFirebaseAuth(foundEmployee.name, foundEmployee.password!, currentActiveStoreId);
          // Try to sign in again after auto-registration
          try {
            await signInWithEmailAndPassword(auth, authEmail, trimPass);
          } catch (e) {
            console.error("Post-registration login failed for employee:", e);
          }
        }

        setCurrentUser(foundEmployee);
        if (foundEmployee.role === 'Vendedor') {
          navigate('/tables');
        } else {
          navigate('/dashboard');
        }
        return;
      }

      // If both Firebase Auth and our database checks failed, show error
      triggerAlert('Credenciais incorretas de Usuário ou Senha. Para o Painel Central use: admin / admin. Para o cliente de teste use: master / 1234');
    } catch (e: any) {
      console.error("Login processing error:", e);
      triggerAlert(`Ocorreu um erro ao processar o login: ${e.message || e}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-margin-mobile md:p-margin-page bg-surface relative overflow-hidden">
      {/* Background Pattern/Atmosphere */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary rounded-full blur-[100px]" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-secondary rounded-full blur-[100px]" />
      </div>

      <main className="relative z-10 w-full max-w-md">
        {/* Logo / Branding Anchor */}
        <div className="text-center mb-8">
          <h1 className="text-display font-extrabold text-primary tracking-tight">
            QuickServe POS
          </h1>
          <p className="text-caption text-on-surface-variant mt-2">
            Sistema de Gestão de Vendas Profissional
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface-container-lowest rounded-[24px] p-8 login-card border border-surface-container-high">
          <header className="mb-8">
            <h2 className="text-headline-md text-on-surface">Bem-vindo de volta</h2>
            <p className="text-body-lg text-on-surface-variant mt-1">
              Acesse sua conta para gerenciar seu negócio.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div className="space-y-2">
              <label 
                htmlFor="username" 
                className="block text-body-lg font-semibold text-on-surface"
              >
                Nome de Usuário
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                  <User size={20} />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Digite seu usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-[16px] text-body-lg text-on-surface placeholder:text-on-surface-variant outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all duration-200"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label 
                  htmlFor="password" 
                  className="text-body-lg font-semibold text-on-surface"
                >
                  Senha
                </label>
                <a href="#" className="text-caption text-secondary hover:underline">
                  Esqueceu a senha?
                </a>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant">
                  <Lock size={20} />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 bg-surface-container-lowest border border-outline-variant rounded-[16px] text-body-lg text-on-surface placeholder:text-on-surface-variant outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-on-surface-variant hover:text-on-surface"
                >
                  <Eye size={20} />
                </button>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-4 bg-brand-primary text-on-primary text-headline-md rounded-[16px] flex items-center justify-center gap-2 shadow-lg hover:brightness-95 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar</span>
                    <LogIn size={20} />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Access Hint */}
          <div className="mt-8 pt-6 border-t border-surface-container-high space-y-3">
            <div className="flex items-start gap-3 bg-[#E8F0FE]/50 border border-info/10 p-3.5 rounded-xl text-caption">
              <Info className="text-primary shrink-0" size={18} />
              <div className="space-y-1">
                <p className="font-bold text-on-surface">Painel SaaS Central Admin (Master)</p>
                <p className="text-on-surface-variant leading-tight">
                  Acesso para gerenciar clientes, planos e serviços:<br />
                  Usuário: <strong className="text-on-surface">admin</strong> / Senha: <strong className="text-on-surface">admin</strong>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-surface-container-low p-3.5 rounded-xl text-caption">
              <Info className="text-secondary shrink-0" size={18} />
              <div className="space-y-1">
                <p className="font-bold text-on-surface">Estabelecimento de Teste (Cliente)</p>
                <p className="text-on-surface-variant leading-tight">
                  Simula o login fornecido ao cliente da loja:<br />
                  Usuário: <strong className="text-on-surface">master</strong> / Senha: <strong className="text-on-surface">1234</strong>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <footer className="mt-8 text-center flex flex-col items-center gap-4">
          <div className="flex items-center gap-6">
            <a href="#" className="text-caption text-on-surface-variant hover:text-primary transition-colors">Termos de Uso</a>
            <a href="#" className="text-caption text-on-surface-variant hover:text-primary transition-colors">Suporte</a>
            <a href="#" className="text-caption text-on-surface-variant hover:text-primary transition-colors">Política de Privacidade</a>
          </div>
          <p className="text-caption text-on-surface-variant/60">
            © 2026 QuickServe POS. Todos os direitos reservados.
          </p>
        </footer>
      </main>
    </div>
  );
}
