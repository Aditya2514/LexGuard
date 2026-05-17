import { useState } from 'react';
import ContractUploadForm from '../components/Contracts/ContractUploadForm';
import ContractList from '../components/Contracts/ContractList';

export default function ContractsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="page-container">
      <ContractUploadForm onUploaded={() => setRefreshKey((k) => k + 1)} />
      <ContractList refreshKey={refreshKey} />
    </div>
  );
}
