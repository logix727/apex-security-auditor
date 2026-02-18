import React from 'react';

interface AssetsContainerProps {
  children: React.ReactNode;
}

export const AssetsContainer: React.FC<AssetsContainerProps> = ({ children }) => {
  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {children}
    </div>
  );
};