// components/StatsCards.tsx
import { Bell } from "lucide-react";

interface StatsCardsProps {
  establishments: any[];
}

const StatsCards = ({ establishments = [] }: StatsCardsProps) => {
  const notificationData = {
    rappels: 3,
    actions: 5,
    suggestions: 2
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 border border-blue-200/50">
        <div className="text-2xl font-bold text-blue-900">{establishments.length}</div>
        <div className="text-sm text-blue-700 font-medium">Total établissements</div>
      </div>
      <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100/50 p-4 border border-orange-200/50">
        <div className="text-2xl font-bold text-orange-900">
          {establishments.filter(e => e.statut === 'prospect').length}
        </div>
        <div className="text-sm text-orange-700 font-medium">Prospects</div>
      </div>
      <div className="rounded-2xl bg-gradient-to-br from-green-50 to-green-100/50 p-4 border border-green-200/50">
        <div className="text-2xl font-bold text-green-900">
          {establishments.filter(e => e.statut === 'client').length}
        </div>
        <div className="text-sm text-green-700 font-medium">Clients actifs</div>
      </div>
      <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 border border-purple-200/50">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-purple-900">
              {notificationData.rappels + notificationData.actions + notificationData.suggestions}
            </div>
            <div className="text-sm text-purple-700 font-medium">Alertes</div>
          </div>
          <div className="relative">
            <Bell className="h-7 w-7 text-purple-600" />
            <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-xs font-bold text-white">
              {notificationData.rappels + notificationData.actions + notificationData.suggestions}
            </span>
          </div>
        </div>
        <div className="mt-2 text-xs text-purple-600">
          {notificationData.rappels} rappels • {notificationData.actions} actions • {notificationData.suggestions} prospects
        </div>
      </div>
    </div>
  );
};

export default StatsCards;