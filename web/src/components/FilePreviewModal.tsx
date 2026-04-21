import { useState, useEffect } from 'react';
import { FaTimes, FaDownload, FaExternalLinkAlt } from 'react-icons/fa';
import PDFPreview from './PDFPreview';
import OfficePreview from './OfficePreview';

interface FilePreviewModalProps {
  fileName: string;
  fileUrl: string;
  onClose: () => void;
}

const FilePreviewModal = ({ fileName, fileUrl, onClose }: FilePreviewModalProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fileType, setFileType] = useState<'pdf' | 'image' | 'text' | 'office' | 'unsupported'>('unsupported');
  const [textContent, setTextContent] = useState('');
  const [loadTimeout, setLoadTimeout] = useState(false);

  useEffect(() => {
    detectFileType();
    
    // Set timeout after 10 seconds
    const timer = setTimeout(() => {
      if (loading) {
        setLoadTimeout(true);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [fileName, fileUrl, loading]);

  const detectFileType = () => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    
    // PDF - Will use PDFPreview component
    if (ext === 'pdf') {
      setFileType('pdf');
      setLoading(false); // PDFPreview handles its own loading
      return;
    }
    
    // Images - Can load directly (usually fast)
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
      setFileType('image');
      return;
    }
    
    // Text files - Can load directly (small size)
    if (['txt', 'md', 'json', 'xml', 'csv', 'log'].includes(ext)) {
      setFileType('text');
      fetchTextContent();
      return;
    }
    
    // Office files - Show info, don't load
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
      setFileType('office');
      setLoading(false);
      return;
    }
    
    setFileType('unsupported');
    setLoading(false);
  };

  const fetchTextContent = async () => {
    try {
      setLoading(true);
      
      // Add timeout - 5 seconds only
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
      
      // Fetch directly from fileUrl (simpler, faster)
      const response = await fetch(fileUrl, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error('Failed to fetch text');
      }
      
      const text = await response.text();
      
      // Limit to 100KB
      if (text.length > 100000) {
        setTextContent(text.substring(0, 100000) + '\n\n... (File quá lớn, chỉ hiển thị 100KB đầu)');
      } else {
        setTextContent(text);
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching text:', err);
      if (err.name === 'AbortError') {
        setTextContent('⏱️ Timeout: File tải quá lâu (>5s). Vui lòng tải xuống để xem.');
        setError(true);
      } else {
        setTextContent('❌ Không thể tải file. Vui lòng tải xuống để xem.');
        setError(true);
      }
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      window.open(fileUrl, '_blank');
    }
  };

  const renderPreview = () => {
    if (loading && !loadTimeout) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Đang tải...</p>
            <p className="text-gray-400 text-sm mt-2">File có thể mất vài giây để tải</p>
          </div>
        </div>
      );
    }

    if (loadTimeout && loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">⏱️</div>
            <h3 className="text-xl font-semibold mb-2">File đang tải chậm</h3>
            <p className="text-gray-600 mb-6">
              File có thể quá lớn hoặc kết nối chậm. Bạn có thể tải xuống để xem.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                <FaDownload /> Tải xuống
              </button>
              <button
                onClick={() => window.open(fileUrl, '_blank')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                <FaExternalLinkAlt /> Mở tab mới
              </button>
              <button
                onClick={() => {
                  setLoadTimeout(false);
                  setLoading(true);
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Thử lại
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-red-500 mb-4">Không thể tải file</p>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Tải xuống thay thế
            </button>
          </div>
        </div>
      );
    }

    switch (fileType) {
      case 'pdf':
        // Use PDFPreview component to show first 2 pages
        return <PDFPreview fileUrl={fileUrl} maxPages={2} />;

      case 'image':
        return (
          <div className="flex items-center justify-center h-full bg-gray-100 p-4">
            <img
              src={fileUrl}
              alt={fileName}
              className="max-w-full max-h-full object-contain"
              onLoad={() => setLoading(false)}
              onError={() => {
                setError(true);
                setLoading(false);
              }}
            />
          </div>
        );

      case 'text':
        if (error && textContent) {
          // Show error message
          return (
            <div className="h-full overflow-auto bg-gray-50 p-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-yellow-800 whitespace-pre-wrap">{textContent}</p>
              </div>
              <div className="text-center mt-4">
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Tải xuống để xem
                </button>
              </div>
            </div>
          );
        }
        if (loading) {
          return (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Đang tải text file...</p>
                <p className="text-gray-400 text-sm mt-2">Tối đa 5 giây</p>
              </div>
            </div>
          );
        }
        return (
          <div className="h-full overflow-auto bg-gray-50 p-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">
                {textContent || 'File trống'}
              </pre>
            </div>
          </div>
        );

      case 'office':
        const ext = fileName.split('.').pop()?.toLowerCase() as 'docx' | 'xlsx' | 'pptx';
        return <OfficePreview fileUrl={fileUrl} fileName={fileName} fileType={ext} />;

      case 'unsupported':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-xl font-semibold mb-2">Không thể xem trước file này</h3>
              <p className="text-gray-600 mb-6">
                Loại file này không hỗ trợ xem trước. Bạn có thể tải xuống để xem.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <FaDownload /> Tải xuống
                </button>
                <button
                  onClick={() => window.open(fileUrl, '_blank')}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  <FaExternalLinkAlt /> Mở tab mới
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{fileName}</h2>
            <p className="text-sm text-gray-500">
              {fileType === 'pdf' && 'PDF Document'}
              {fileType === 'image' && 'Hình ảnh'}
              {fileType === 'text' && 'Text File'}
              {fileType === 'office' && 'Office Document'}
              {fileType === 'unsupported' && 'File'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Tải xuống"
            >
              <FaDownload className="text-gray-600" />
            </button>
            <button
              onClick={() => window.open(fileUrl, '_blank')}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Mở tab mới"
            >
              <FaExternalLinkAlt className="text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Đóng"
            >
              <FaTimes className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-hidden">
          {renderPreview()}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
