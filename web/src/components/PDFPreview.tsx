import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PDFPreviewProps {
  fileUrl: string;
  maxPages?: number; // Số trang tối đa để preview (default: 2)
}

const PDFPreview = ({ fileUrl, maxPages = 2 }: PDFPreviewProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    loadPDF();
  }, [fileUrl]);

  const loadPDF = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument(fileUrl);
      const pdf = await loadingTask.promise;
      
      setTotalPages(pdf.numPages);
      const pagesToRender = Math.min(maxPages, pdf.numPages);

      // Render each page
      for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const canvas = canvasRefs.current[pageNum - 1];
        
        if (!canvas) continue;

        const context = canvas.getContext('2d');
        if (!context) continue;

        // Calculate scale to fit width
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(800 / viewport.width, 1.5); // Max width 800px, max scale 1.5x
        const scaledViewport = page.getViewport({ scale });

        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        // Render page
        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading PDF:', err);
      setError(err.message || 'Không thể tải PDF');
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
          <p className="text-gray-500 text-sm">Vui lòng thử mở file trong tab mới</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-gray-50 overflow-auto max-h-full">
      {Array.from({ length: Math.min(maxPages, totalPages) }, (_, i) => (
        <div key={i} className="bg-white rounded-lg shadow-md p-2">
          <canvas
            ref={(el) => (canvasRefs.current[i] = el)}
            className="w-full h-auto"
          />
          <p className="text-center text-sm text-gray-500 mt-2">
            Trang {i + 1} / {totalPages}
          </p>
        </div>
      ))}
      
      {totalPages > maxPages && (
        <div className="text-center py-4 bg-blue-50 rounded-lg">
          <p className="text-blue-700 font-medium">
            📄 Còn {totalPages - maxPages} trang nữa
          </p>
          <p className="text-blue-600 text-sm mt-1">
            Tải xuống hoặc mở tab mới để xem toàn bộ
          </p>
        </div>
      )}
    </div>
  );
};

export default PDFPreview;
