import { FC } from 'react';

interface SidebarProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
}

const sections = [
  { id: 'overview', label: 'Visão Geral', icon: 'fas fa-chart-line' },
  { id: 'admin-metrics', label: 'Métricas', icon: 'fas fa-gauge-high' },
  { id: 'register', label: 'Criar Conta', icon: 'fas fa-user-plus' },
  { id: 'users', label: 'Usuários', icon: 'fas fa-users' },
  { id: 'otps', label: 'OTPs', icon: 'fas fa-shield-halved' },
  { id: 'password-reset', label: 'Redefinir Senha', icon: 'fas fa-key' },
  { id: 'logs', label: 'Logs', icon: 'fas fa-clock-rotate-left' },
];

const adminSections = [
  { id: 'admin-users', label: 'Gestão de Usuários', icon: 'fas fa-user-gear' },
  { id: 'admin-otps', label: 'Gestão de OTPs', icon: 'fas fa-lock' },
  { id: 'cleanup', label: 'Limpeza', icon: 'fas fa-broom' },
];

const Sidebar: FC<SidebarProps> = ({ currentSection, onSectionChange }) => {
  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0 bottom-0 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <i className="fas fa-shield-halved text-lg"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">OTP CAOP-B</h2>
            <p className="text-xs text-gray-400">Sistema de Autenticação</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">Principal</p>
          <ul className="space-y-1">
            {sections.map(section => (
              <li key={section.id}>
                <button
                  onClick={() => onSectionChange(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    currentSection === section.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <i className={`${section.icon} w-5 text-center`}></i>
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">Administração</p>
          <ul className="space-y-1">
            {adminSections.map(section => (
              <li key={section.id}>
                <button
                  onClick={() => onSectionChange(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    currentSection === section.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <i className={`${section.icon} w-5 text-center`}></i>
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-xs font-bold">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Admin</p>
            <p className="text-xs text-gray-400">admin@caop-b.com</p>
          </div>
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
