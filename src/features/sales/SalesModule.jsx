import { useState } from 'react';
import SalesListView from './SalesListView.jsx';
import SalesStatusView from './SalesStatusView.jsx';

export default function SalesModule({ activeTab }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  // Filtro para distinguir registros con/sin vendedor asignado
  // Valores: '' | 'assigned' | 'unassigned'
  const [filterVendorAssigned, setFilterVendorAssigned] = useState('');
  const [filterEstatus, setFilterEstatus] = useState(null);
  const [filterPlaza, setFilterPlaza] = useState('');

  // Determinar qué vista mostrar - cada vista carga sus propios datos
  if (activeTab === 'm1' || activeTab === 'm2' || activeTab === 'm3' || activeTab === 'm4') {
    const status = activeTab.toUpperCase();
    return (
      <SalesStatusView 
        status={status}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterVendor={filterVendor}
        setFilterVendor={setFilterVendor}
        filterVendorAssigned={filterVendorAssigned}
        setFilterVendorAssigned={setFilterVendorAssigned}
        filterEstatus={filterEstatus}
        setFilterEstatus={setFilterEstatus}
        filterPlaza={filterPlaza}
        setFilterPlaza={setFilterPlaza}
      />
    );
  }

  return (
    <SalesListView 
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      filterVendor={filterVendor}
      setFilterVendor={setFilterVendor}
      filterVendorAssigned={filterVendorAssigned}
      setFilterVendorAssigned={setFilterVendorAssigned}
      filterPlaza={filterPlaza}
      setFilterPlaza={setFilterPlaza}
    />
  );
}

