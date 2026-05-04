import { FC } from 'react';

interface SidebarProps {
  currentSection: string;
  onSectionChange: (section: string) => void;
}

const LOGO_URL = 'https://caop-b.com/assets/Caop-B-Logo-PNG.png';

const sections = [
  { id: 'overview', label: 'Visão Geral', icon: 'fas fa-chart-line' },
  { id: 'admin-metrics', label: 'Métricas', icon: 'fas fa-gauge-high' },
  { id: 'register', label: 'Criar Conta', icon: 'fas fa-user-plus' },
  { id: 'users', label: 'Usuários', icon: 'fas fa-users' },
  { id: 'otps', label: 'OTPs', icon: 'fas fa-shield-halved' },
  { id: 'password-reset', label: 'Redefinir Senha', icon: 'fas fa-key' },
  { id: 'logs', label: 'Logs', icon: 'fas fa-clock-rotate-left' },
];

const businessSections = [
  { id: 'reservations', label: 'Reservas', icon: 'fas fa-calendar-check' },
  { id: 'establishments', label: 'Estabelecimentos', icon: 'fas fa-store' },
  { id: 'agent-orders', label: 'Pedidos do Agente', icon: 'fas fa-receipt' },
  { id: 'agent-reservations', label: 'Reservas do Agente', icon: 'fas fa-calendar-days' },
  { id: 'agent-messages', label: 'Mensagens do Agente', icon: 'fas fa-paper-plane' },
  { id: 'error-reports', label: 'Relatórios de Erros', icon: 'fas fa-bug' },
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
        <div className="flex flex-col items-center text-center">
          <img
            src={LOGO_URL}
            alt="CAOP-B"
            className="h-14 w-auto mb-3 drop-shadow-lg"
          />
          <h2 className="text-sm font-semibold tracking-wide text-white/90 uppercase">Painel Administrativo</h2>
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
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">Negócio</p>
          <ul className="space-y-1">
            {businessSections.map(section => (
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
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-xs font-bold text-white">
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
