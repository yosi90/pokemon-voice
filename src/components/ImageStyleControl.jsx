export function ImageStyleControl({ imageStyle, onImageStyle, className = '', name = 'imageStyle' }) {
  return (
    <fieldset className={`image-style-control ${className}`.trim()} aria-label="Estilo de imagen">
      <legend>Imagen</legend>
      <label className={`image-style-option ${imageStyle === '3d' ? 'active' : ''}`}>
        <input type="radio" name={name} value="3d" checked={imageStyle === '3d'} onChange={() => onImageStyle('3d')} />
        <span>3D</span>
      </label>
      <label className={`image-style-option ${imageStyle === 'sprite' ? 'active' : ''}`}>
        <input type="radio" name={name} value="sprite" checked={imageStyle === 'sprite'} onChange={() => onImageStyle('sprite')} />
        <span>Sprite</span>
      </label>
    </fieldset>
  );
}
