// 预设配色 + import.meta.glob 自动发现 bg/ 中的图片

const presets = [
  { id: 'classic', type: 'color', name: '经典绿', value: '#9ead86' },
  { id: 'night', type: 'color', name: '暗夜黑', value: '#1a1a2e' },
  { id: 'ocean', type: 'color', name: '海洋蓝', value: '#1b4965' },
  { id: 'sakura', type: 'color', name: '樱花粉', value: '#f0d5d5' },
  { id: 'sunset', type: 'color', name: '日落橙', value: '#e8b4b8' },
];

// Vite: import.meta.glob 替代 webpack require.context
const bgModules = import.meta.glob('../resource/bg/*.{png,jpg,jpeg,gif}', { eager: true });
const customs = Object.keys(bgModules).map((key) => {
  const filename = key.replace('../resource/bg/', '');
  const name = filename.replace(/\.\w+$/, '');
  return {
    id: `bg_${name}`,
    type: 'image',
    name,
    src: bgModules[key].default,
  };
});

const allThemes = presets.concat(customs);
const defaultTheme = 'classic';

export { allThemes, defaultTheme };
