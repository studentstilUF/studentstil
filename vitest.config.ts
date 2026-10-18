import { defineConfig } from 'vitest/config';

// Testerna gäller logik (validering, Swish-länkar, lösenord, CSV, PDF) och körs i Node.
export default defineConfig({
  test: {
    projects: [
      {
        extends: false,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts', 'netlify/**/*.test.ts'],
        },
      },
    ],
  },
});
