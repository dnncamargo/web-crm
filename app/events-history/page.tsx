import EventsHistory from '@/app/components/EventsHistory';

const EventsHistoryPage = () => {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4 text-gray-800">Histórico de Eventos</h1>
      <EventsHistory />
    </div>
  );
};

export default EventsHistoryPage;