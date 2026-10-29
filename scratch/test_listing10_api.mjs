import { pool } from '../server/src/config/database.js';
import * as listingModel from '../server/src/models/listing.model.js';

// We can import getListingByIdJson or run the same logic
async function main() {
  const listing = await listingModel.getListingById(10);
  console.log('Listing raw:', listing);
  
  // Let's import resolveListingPreview from supplier.controller.js by testing its output
  const { default: supplierCtrl } = await import('../server/src/controllers/supplier.controller.js');
  
  const req = { params: { id: '10' } };
  const res = {
    json: (data) => {
      console.log('Returned JSON:');
      console.log('Title:', data.title);
      console.log('Design color:', data.design_color);
      console.log('Available colors:', data.available_colors);
      console.log('Preview by color count:', data.preview_by_color?.length);
      console.log('Preview by color items:', data.preview_by_color?.map(c => ({
        id: c.id,
        hex: c.hex,
        name: c.name,
        has_front: Boolean(c.preview_front),
        has_back: Boolean(c.preview_back)
      })));
    },
    status: (code) => {
      console.log('Status:', code);
      return res;
    }
  };
  await supplierCtrl.getListingByIdJson(req, res, (err) => console.error('Next err:', err));

  process.exit(0);
}
main().catch(console.error);
