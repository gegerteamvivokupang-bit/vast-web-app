const fs = require('fs');
const path = require('path');

// Simple SVG icon generator for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create SVG icon with VAST branding (indigo color #4f46e5)
const createSVGIcon = (size) => {
  const fontSize = Math.floor(size * 0.35);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#4f46e5"/>
  <text x="50%" y="55%" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-weight="bold" font-size="${fontSize}">VS</text>
</svg>`;
};

// Generate icons
sizes.forEach(size => {
  const svgContent = createSVGIcon(size);
  const filePath = path.join(iconsDir, `icon-${size}x${size}.svg`);
  fs.writeFileSync(filePath, svgContent);
  console.log(`Created: icon-${size}x${size}.svg`);
});

console.log('\nSVG icons generated! For PNG icons, you can use online tools like:');
console.log('- https://realfavicongenerator.net/');
console.log('- https://www.pwabuilder.com/imageGenerator');
