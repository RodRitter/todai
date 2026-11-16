export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { execution } = await import('./server/execution');
    execution();
  }
}
