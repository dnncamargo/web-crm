'use client';

import { ReactNode } from 'react';

interface BottomSheetProps {
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

const BottomSheet = ({ onClose, children, title }: BottomSheetProps) => {

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
      <div className="bg-white w-full rounded-t-2xl p-4 shadow-lg max-h-[90vh] overflow-y-auto">
        {title && <h2 className="text-lg font-semibold mb-4">{title}</h2>}

        {children}

        <button
          onClick={onClose}
          className="mt-4 w-full py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};

export default BottomSheet;
