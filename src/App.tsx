import { useEffect, type ComponentType } from 'react';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Services } from './pages/Services';
import { Gallery } from './pages/Gallery';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { useHashRoute, type Route } from './hooks/useHashRoute';
import { useReveals } from './hooks/useReveals';

const PAGES: Record<Route, ComponentType> = {
  home: Home,
  services: Services,
  gallery: Gallery,
  about: About,
  contact: Contact,
};

const TITLES: Record<Route, string> = {
  home: 'Custom Embroidery in St. Louis',
  services: 'Services',
  gallery: 'Gallery',
  about: 'About Us',
  contact: 'Get a Quote',
};

export function App() {
  const route = useHashRoute();
  useReveals(route);
  useEffect(() => {
    document.title = 'Stitches-n-Color Embroidery Studio — ' + TITLES[route];
  }, [route]);

  const Page = PAGES[route] ?? Home;

  return (
    <>
      <Nav route={route} />
      <Page key={route} />
      <Footer />
    </>
  );
}
