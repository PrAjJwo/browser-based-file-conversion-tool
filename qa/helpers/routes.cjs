const fs = require('fs');
const path = require('path');

const TOOLS_PATH = path.resolve(__dirname, '../../src/data/tools.ts');

function parseTools() {
  const content = fs.readFileSync(TOOLS_PATH, 'utf-8');

  // Parse Categories
  const categoryIds = ['image', 'video', 'pdf', 'audio'];

  // Parse Tools
  const toolBlocks = content.split(/\{\s*slug:\s*['"]/).slice(1);
  const tools = [];

  for (const block of toolBlocks) {
    const slugMatch = block.match(/^([^'"]+)['"]/);
    const categoryMatch = block.match(/category:\s*['"]([^'"]+)['"]/);
    const titleMatch = block.match(/title:\s*['"]([^'"]+)['"]/);
    const statusMatch = block.match(/status:\s*['"]([^'"]+)['"]/);
    const groupMatch = block.match(/group:\s*['"]([^'"]+)['"]/);
    const blurbMatch = block.match(/shortBlurb:\s*['"]([^'"]+)['"]/);

    if (slugMatch && categoryMatch && titleMatch) {
      const slug = slugMatch[1];
      const category = categoryMatch[1];
      const title = titleMatch[1];
      const status = statusMatch ? statusMatch[1] : 'active';
      const group = groupMatch ? groupMatch[1] : '';
      const shortBlurb = blurbMatch ? blurbMatch[1] : '';

      tools.push({
        slug,
        category,
        title,
        group,
        shortBlurb,
        status,
        route: `/${category}/${slug}`,
      });
    }
  }

  return {
    categories: categoryIds.map((c) => ({
      id: c,
      route: `/${c}`,
    })),
    tools,
  };
}

function getActiveTools() {
  return parseTools().tools.filter((t) => t.status === 'active');
}

function getAllTools() {
  return parseTools().tools;
}

function getCategoryRoutes() {
  return parseTools().categories.map((c) => c.route);
}

function getAllAppRoutes() {
  const { categories, tools } = parseTools();
  return [
    '/',
    ...categories.map((c) => c.route),
    ...tools.map((t) => t.route),
    '/about',
    '/privacy',
    '/terms',
    '/contact',
  ];
}

module.exports = {
  parseTools,
  getActiveTools,
  getAllTools,
  getCategoryRoutes,
  getAllAppRoutes,
};
