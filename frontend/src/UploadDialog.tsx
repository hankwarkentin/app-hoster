import React, { useState } from 'react';

interface UploadDialogProps {
  onUpload: (file: File) => void;
}

const UploadDialog: React.FC<UploadDialogProps> = ({ onUpload }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.apk')) {
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
      alert('Please select a valid APK file.');
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".apk"
        onChange={handleFileChange}
      />
      <button
        disabled={!selectedFile}
        onClick={handleUpload}
      >
        Upload APK
      </button>
    </div>
  );
};

export default UploadDialog;
