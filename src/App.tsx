import { useEffect } from 'react';
import Rodja from './Rodja';
import Graveyard from './Graveyard';

export default function App() {
  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.background = '#000';
  }, []);

  if (window.location.hash === '#graveyard') return <Graveyard />;
  return <Rodja />;
}
