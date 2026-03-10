module.exports = {
  '*.{ts,tsx}': (files) => {
    const filtered = files.filter(
      (f) => !f.includes('/src/generated/') && !f.includes('\\src\\generated\\'),
    );

    if (filtered.length === 0) {
      return [];
    }

    const escaped = filtered.map((file) => JSON.stringify(file)).join(' ');

    return [`prettier --write ${escaped}`, `eslint --fix ${escaped}`];
  },
};
