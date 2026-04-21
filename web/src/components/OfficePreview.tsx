import { useState, useEffect } from 'react';
import axiosInstance from '../utils/axios';

interface OfficePreviewProps {
  fileUrl: string;
  fileName: string;
  fileType: 'docx' | 'xlsx' | 'pptx';
}

const OfficePreview = ({ fileUrl, fileName, fileType }: OfficePreviewProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<any>(null);

  useEffect(() => {
    loadPreview();
  }, [fileUrl, fileType]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      if (fileType === 'docx') {
        const response = await axiosInstance.post('/files/preview/docx', { fileUrl });
        setContent({ type: 'html', data: response.data.html });
      } else if (fileType === 'xlsx') {
        const response = await axiosInstance.post('/files/preview/xlsx', { fileUrl, maxRows: 50 });
        setContent({ type: 'table', data: response.data });
      } else if (fileType === 'pptx') {
        const response = await axiosInstance.post('/files/preview/pptx', { fileUrl, maxSlides: 5 });
        setContent({ type: 'pptx', data: response.data });
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading preview:', err);
      setError(err.response?.data?.error || 'Không thể tải preview');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải preview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-red-500 mb-2">❌ {error}</p>
          <p className="text-gray-500 text-sm">Vui lòng tải xuống để xem</p>
        </div>
      </div>
    );
  }

  if (!content) return null;

  // Render Word document (HTML)
  if (content.type === 'html') {
    return (
      <div className="p-6 bg-white overflow-auto max-h-full">
        <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: content.data }}
          />
        </div>
        <div className="text-center mt-6 text-sm text-gray-500">
          📄 Preview của {fileName}
        </div>
      </div>
    );
  }

  // Render Excel spreadsheet (Table)
  if (content.type === 'table') {
    const { data, totalRows, previewRows, currentSheet } = content.data;
    
    return (
      <div className="p-4 bg-gray-50 overflow-auto max-h-full">
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <h3 className="font-semibold text-lg mb-2">📊 {currentSheet}</h3>
          <p className="text-sm text-gray-600">
            Hiển thị {previewRows} / {totalRows} dòng
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((row: any[], rowIndex: number) => (
                <tr key={rowIndex} className={rowIndex === 0 ? 'bg-gray-50 font-semibold' : ''}>
                  {row.map((cell: any, cellIndex: number) => (
                    <td
                      key={cellIndex}
                      className="px-4 py-2 text-sm text-gray-900 border-r border-gray-200 whitespace-nowrap"
                    >
                      {cell !== null && cell !== undefined ? String(cell) : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalRows > previewRows && (
          <div className="text-center py-4 bg-blue-50 rounded-lg mt-4">
            <p className="text-blue-700 font-medium">
              📊 Còn {totalRows - previewRows} dòng nữa
            </p>
            <p className="text-blue-600 text-sm mt-1">
              Tải xuống để xem toàn bộ
            </p>
          </div>
        )}
      </div>
    );
  }

  // Render PowerPoint (Basic info)
  if (content.type === 'pptx') {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center max-w-2xl px-6">
          <div className="mb-6">
            {/* PowerPoint Icon */}
            <div className="inline-block p-6 bg-white rounded-2xl shadow-lg mb-4">
              <svg className="w-20 h-20" viewBox="0 0 96 96" fill="none">
                <path d="M0 12C0 5.373 5.373 0 12 0h52l20 20v64c0 6.627-5.373 12-12 12H12c-6.627 0-12-5.373-12-12V12z" fill="#D24726"/>
                <path d="M64 0l20 20H68c-2.21 0-4-1.79-4-4V0z" fill="#B83B1D"/>
                <text x="48" y="58" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="Arial">PPT</text>
              </svg>
            </div>
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 mb-3">{fileName}</h3>
          <p className="text-gray-600 mb-6">Microsoft PowerPoint Presentation</p>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-orange-800">
              <strong>📊 PowerPoint Preview:</strong> Xem trước PowerPoint yêu cầu tải file về hoặc mở trong ứng dụng.
            </p>
            <ul className="text-sm text-orange-700 mt-2 ml-4 list-disc">
              <li>Tải xuống và mở bằng Microsoft PowerPoint/LibreOffice Impress</li>
              <li>Mở trong tab mới để xem bằng trình duyệt</li>
              <li>Sử dụng Google Slides để xem online</li>
            </ul>
          </div>

          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = fileUrl;
                link.download = fileName;
                link.click();
              }}
              className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-md transition-all"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 3a1 1 0 011 1v5.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L9 9.586V4a1 1 0 011-1z"/>
                <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
              </svg>
              Tải xuống để xem
            </button>
            <button
              onClick={() => window.open(fileUrl, '_blank')}
              className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 shadow-md transition-all"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
              </svg>
              Mở trong tab mới
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default OfficePreview;
