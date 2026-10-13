import { CartProvider } from '@/components/order/CartProvider';
import { getMenu } from '@/lib/menu';

export default async function OrderLayout({ children }: { children: React.ReactNode }) {
  const menu = await getMenu();
  return <CartProvider menu={menu}>{children}</CartProvider>;
}
