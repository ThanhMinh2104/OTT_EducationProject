/**
 * Tính toán tọa độ (x, y) của con trỏ (caret) trong một phần tử input hoặc textarea.
 * @param element Phần tử input hoặc textarea.
 * @returns Một đối tượng chứa tọa độ x và y tương đối so với viewport.
 */
export function getCaretCoordinates(element: HTMLInputElement | HTMLTextAreaElement): { x: number; y: number } {
  const { selectionStart } = element;
  if (selectionStart === null) return { x: 0, y: 0 };

  // Tạo một phần tử ẩn (ghost element) để mô phỏng input/textarea
  const div = document.createElement('div');
  const style = window.getComputedStyle(element);

  // Sao chép các kiểu dáng thiết yếu
  const properties = [
    'direction',
    'fontFamily',
    'fontSize',
    'fontSizeAdjust',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'height',
    'letterSpacing',
    'lineHeight',
    'paddingBottom',
    'paddingLeft',
    'paddingRight',
    'paddingTop',
    'textAlign',
    'textDecoration',
    'textIndent',
    'textTransform',
    'width',
    'wordSpacing',
  ];

  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';

  properties.forEach((prop) => {
    (div.style as any)[prop] = (style as any)[prop];
  });

  // Mô phỏng nội dung cho đến vị trí con trỏ
  const textContent = element.value.substring(0, selectionStart);
  div.textContent = textContent;

  // Thêm một thẻ span đánh dấu
  const span = document.createElement('span');
  span.textContent = element.value.substring(selectionStart) || '.';
  div.appendChild(span);

  document.body.appendChild(div);

  const rect = element.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();

  // Tính toán tọa độ tương đối so với phần tử input
  const x = rect.left + spanRect.left - divRect.left + parseFloat(style.paddingLeft);
  const y = rect.top + spanRect.top - divRect.top + parseFloat(style.paddingTop);

  document.body.removeChild(div);

  return { x, y };
}
