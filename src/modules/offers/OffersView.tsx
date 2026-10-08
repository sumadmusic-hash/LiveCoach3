import { useState, useEffect } from 'react';
import { offerRepository } from '../../core/db/repositories';
import type { Offer } from '../../core/schemas';
import type { OfferCategory } from '../../core/schemas';
import { ShoppingBag, Upload, Search, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const categories: OfferCategory[] = ['Obst & Gemüse', 'Fleisch & Wurst', 'Milch & Käse', 'Brot & Backwaren', 'Tiefkühl', 'Getränke', 'Süßigkeiten', 'Haushalt', 'Körperpflege', 'Sonstiges'];

function parseOfferText(text: string): { name: string; price: number; store: string }[] {
  const lines = text.split('\n').filter(l => l.trim());
  const results: { name: string; price: number; store: string }[] = [];
  const priceRegex = /(\d+[.,]\d{2})\s*€?/;
  for (const line of lines) {
      const match = line.match(priceRegex);
    if (match && match[1]) {
      const price = parseFloat(match[1].replace(',', '.'));      const name = line.replace(priceRegex, '').replace(/[\d€.,\s]+$/g, '').trim();
      if (name && price > 0 && price < 1000) {
        results.push({ name, price, store: 'Manuell' });
      }
    }
  }
  return results;
}

export default function OffersView() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'scanner' | 'compare'>('list');
  const [ocrText, setOcrText] = useState('');
  const [parsedOffers, setParsedOffers] = useState<{ name: string; price: number; store: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiProducts, setApiProducts] = useState<any[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => { loadOffers(); }, []);

  async function loadOffers() {
    setLoading(true);
    const o = await offerRepository.getAll();
    setOffers(o);
    setLoading(false);
  }

  function handleOcrText() {
    const parsed = parseOfferText(ocrText);
    setParsedOffers(parsed);
    if (parsed.length === 0) {
      toast.error('Keine Preise im Text erkannt');
    } else {
      toast.success(`${parsed.length} Angebote erkannt`);
    }
  }

  async function importParsed() {
    for (const p of parsedOffers) {
      await offerRepository.create({
        productName: p.name,
        price: p.price,
        store: p.store,
        category: 'Sonstiges',
      });
    }
    setParsedOffers([]);
    setOcrText('');
    loadOffers();
    toast.success('Angebote importiert');
  }

  async function searchProducts() {
    if (!searchQuery.trim()) return;
    setApiLoading(true);
    setApiError('');
    try {
      const res = await fetch(`https://supermarket-price-api-production.up.railway.app/api/v1/products?q=${encodeURIComponent(searchQueryQuery())}&limit=20`);
      if (!res.ok) throw new Error('API nicht erreichbar');
      const data = await res.json();
      setApiProducts(data.products || data || []);
    } catch {
      setApiError('Preisvergleich-API nicht erreichbar. Bitte später erneut versuchen.');
    } finally {
      setApiLoading(false);
    }
  }

  function searchQueryQuery() {
    return searchQuery.trim();
  }

  async function deleteOffer(id: string) {
    await offerRepository.delete(id);
    loadOffers();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Angebote</h1>
        <div className="flex gap-1">
          {(['list', 'scanner', 'compare'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-lg text-sm ${view === v ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
              {v === 'list' ? 'Liste' : v === 'scanner' ? 'Scanner' : 'Vergleich'}
            </button>
          ))}
        </div>
      </div>

      {view === 'list' && (
        <>
          {loading ? (
            <div className="animate-pulse h-32 bg-gray-200 dark:bg-gray-700 rounded" />
          ) : offers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ShoppingBag size={48} className="mx-auto mb-3 opacity-50" />
              <p>Noch keine Angebote gespeichert</p>
              <p className="text-sm mt-1">Nutze den Scanner oder Preisvergleich</p>
            </div>
          ) : (
            <div className="space-y-2">
              {offers.map(offer => (
                <div key={offer.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{offer.productName}</p>
                    <p className="text-xs text-gray-400">{offer.store} · {offer.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-green-600">{offer.price.toFixed(2)} €</span>
                    {offer.originalPrice && <span className="text-xs line-through text-gray-400">{offer.originalPrice.toFixed(2)} €</span>}
                    <button onClick={() => deleteOffer(offer.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {view === 'scanner' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <h3 className="font-semibold">Prospekt-Scanner</h3>
            <p className="text-sm text-gray-500">Füge den Text eines Prospekts ein oder lade ein Bild hoch. Preise werden automatisch erkannt.</p>
            <textarea value={ocrText} onChange={e => setOcrText(e.target.value)} placeholder="Text aus Prospekt hier einfügen..." className="w-full h-32 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm resize-none" />
            <div className="flex gap-2">
              <button onClick={handleOcrText} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Analysieren</button>
              {parsedOffers.length > 0 && (
                <button onClick={importParsed} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">{parsedOffers.length} importieren</button>
              )}
            </div>
          </div>
          {parsedOffers.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Erkannte Angebote:</h4>
              {parsedOffers.map((p, i) => (
                <div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-sm">
                  <span>{p.name}</span>
                  <span className="font-bold text-green-600">{p.price.toFixed(2)} €</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'compare' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <h3 className="font-semibold">Preisvergleich</h3>
            <div className="flex gap-2">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Produkt suchen..." className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm" onKeyDown={e => e.key === 'Enter' && searchProducts()} />
              <button onClick={searchProducts} disabled={apiLoading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                {apiLoading ? '...' : 'Suchen'}
              </button>
            </div>
            {apiError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600">
                <AlertCircle size={16} />
                {apiError}
              </div>
            )}
            {apiProducts.length > 0 && (
              <div className="space-y-2 mt-3">
                {apiProducts.slice(0, 10).map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-sm">
                    <span>{p.name || p.title || 'Produkt'}</span>
                    <span className="font-bold text-green-600">{p.price ? `${Number(p.price).toFixed(2)} €` : '–'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
