import { redirect } from 'next/navigation';

export default function WebsiteIndex(): never {
  redirect('/website/status');
}
