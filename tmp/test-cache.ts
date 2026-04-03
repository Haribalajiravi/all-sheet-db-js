
import { cacheManager } from '../src/core/CacheManager';

async function testCache() {
  const key = 'test:key';
  const data = { hello: 'world' };
  
  console.log('Setting cache...');
  await cacheManager.set(key, data);
  
  console.log('Getting cache...');
  const cached = await cacheManager.get(key);
  console.log('Cached data:', cached);
  
  if (JSON.stringify(cached) === JSON.stringify(data)) {
    console.log('SUCCESS: Cache works!');
  } else {
    console.log('FAILURE: Cache mismatch or not found');
  }
}

testCache();
