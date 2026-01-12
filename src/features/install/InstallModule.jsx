import { useState } from 'react';
import InstallListView from './InstallListView.jsx';

export default function InstallModule({ activeTab }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCiudad, setFilterCiudad] = useState('');

  // InstallListView carga sus propios datos cuando se monta
  return (
    <InstallListView 
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      filterCiudad={filterCiudad}
      setFilterCiudad={setFilterCiudad}
    />
  );
}

