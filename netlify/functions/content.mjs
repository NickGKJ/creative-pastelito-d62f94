import { getStore } from '@netlify/blobs'

function getContentStore() {
  return getStore({ name: 'aac-content', consistency: 'strong' })
}

export default async (req) => {
  const store = getContentStore()

  if (req.method === 'GET') {
    const data = await store.get('app-data', { type: 'json' })
    return Response.json(data || { categories: [], items: [], version: 0 })
  }

  if (req.method === 'POST') {
    const data = await req.json()
    data.version = Date.now()
    await store.setJSON('app-data', data)
    return Response.json({ ok: true, version: data.version })
  }

  return new Response('Method not allowed', { status: 405 })
}
