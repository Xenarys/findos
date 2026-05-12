'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface BienServicio {
  id: string
  codigo: string
  descripcion: string
  unidad: string
  moneda: string
  afecto_iva_compra: boolean
  esquema_tributario_compra_id: string | null
}

interface CondicionPago {
  id: string
  nombre: string
}

interface Entidad {
  id: string
  razon_social: string
  rut: string
}

interface ItemForm {
  id?: string
  bien_servicio_id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  bien?: BienServicio
}

export default function EditarOCPage() {
  const { id } = useParams()
  const router = useRouter()

  const [proveedores, setProveedores] = useState<Entidad[]>([])
  const [bienes, setBienes] = useState<BienServicio[]>([])
  const [condicionesPago, setCondicionesPago] = useState<CondicionPago[]>([])
  const [guardando, setGuardando] = useState(false)
  const [loading, setLoading] = useState(true)

  const [cabecera, setCabecera] = useState({
    proveedor_id: '',
    fecha: new Date().toISOString().split('T')[0],
    condicion_pago_id: '',
    moneda: 'CLP',
    observaciones: ''
  })

  const [items, setItems] = useState<ItemForm[]>([])
  const [itemsEliminados, setItemsEliminados] = useState<string[]>([])
  const [bienSeleccionado, setBienSeleccionado] = useState('')

  useEffect(() => { cargarTodo() }, [id])

  async function cargarTodo() {
    setLoading(true)
    const [provs, bs, cps, ocData, itemsData] = await Promise.all([
      supabase.from('entidades').select('id, razon_social, rut').eq('tipo_proveedor', true).eq('activo', true).order('razon_social'),
      supabase.from('bienes_servicios').select('id, codigo, descripcion, unidad, moneda, afecto_iva_compra, esquema_tributario_compra_id').eq('activo', true).order('descripcion'),
      supabase.from('condiciones_pago').select('id, nombre').eq('activo', true).order('dias'),
      supabase.from('ordenes_compra').select('*').eq('id', id).single(),
      supabase.from('ordenes_compra_items').select('*, bienes_servicios(id, codigo, descripcion, unidad, moneda, afecto_iva_compra, esquema_tributario_compra_id)').eq('orden_compra_id', id).order('created_at'),
    ])
    if (provs.data) setProveedores(provs.data)
    if (bs.data) setBienes(bs.data)
    if (cps.data) setCondicionesPago(cps.data)
    if (ocData.data) {
      setCabecera({
        proveedor_id: ocData.data.proveedor_id || '',
        fecha: ocData.data.fecha || '',
        condicion_pago_id: ocData.data.condicion_pago_id || '',
        moneda: ocData.data.moneda || 'CLP',
        observaciones: ocData.data.observaciones || ''
      })
    }
    if (itemsData.data) {
      setItems(itemsData.data.map((i: any) => ({
        id: i.id,
        bien_servicio_id: i.bien_servicio_id,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
        bien: i.bienes_servicios
      })))
    }
    setLoading(false)
  }

  function agregarItem() {
    if (!bienSeleccionado) return alert('Selecciona un bien o servicio')
    const bien = bienes.find(b => b.id === bienSeleccionado)
    if (!bien) return
    setItems([...items, {
      bien_servicio_id: bien.id,
      descripcion: bien.descripcion,
      cantidad: 1,
      precio_unitario: 0,
      subtotal: 0,
      bien
    }])
    setBienSeleccionado('')
  }

  function actualizarItem(idx: number, campo: string, valor: any) {
    const nuevos = [...items]
    nuevos[idx] = { ...nuevos[idx], [campo]: valor }
    if (campo === 'cantidad' || campo === 'precio_unitario') {
      nuevos[idx].subtotal = nuevos[idx].cantidad * nuevos[idx].precio_unitario
    }
    setItems(nuevos)
  }

  function eliminarItem(idx: number) {
    const item = items[idx]
    if (item.id) setItemsEliminados([...itemsEliminados, item.id])
    setItems(items.filter((_, i) => i !== idx))
  }

  const totalNeto = items.reduce((sum, i) => sum + i.subtotal, 0)
  const fmt = (n: number) => new Intl.NumberFormat('es-CL').format(Math.round(n))

  async function guardar() {
    if (!cabecera.proveedor_id) return alert('Selecciona un proveedor')
    if (items.length === 0) return alert('Agrega al menos un ítem')
    setGuardando(true)

    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()

    // Actualizar cabecera
    const { error } = await supabase.from('ordenes_compra').update({
      proveedor_id: cabecera.proveedor_id,
      fecha: cabecera.fecha,
      condicion_pago_id: cabecera.condicion_pago_id || null,
      moneda: cabecera.moneda,
      observaciones: cabecera.observaciones || null,
      total_neto: totalNeto,
      total_impuestos: 0,
      total: totalNeto,
      updated_by: user?.email, updated_at: ahora
    }).eq('id', id)

    if (error) { alert('Error: ' + error.message); setGuardando(false); return }

    // Eliminar ítems borrados
    if (itemsEliminados.length > 0) {
      await supabase.from('ordenes_compra_items').delete().in('id', itemsEliminados)
    }

    // Actualizar o insertar ítems
    for (const item of items) {
      if (item.id) {
        await supabase.from('ordenes_compra_items').update({
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
          updated_by: user?.email, updated_at: ahora
        }).eq('id', item.id)
      } else {
        await supabase.from('ordenes_compra_items').insert([{
          orden_compra_id: id,
          bien_servicio_id: item.bien_servicio_id,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
          cantidad_confirmada: 0,
          documento_abierto: true,
          created_by: user?.email, updated_by: user?.email, updated_at: ahora
        }])
      }
    }

    router.push(`/compras/${id}`)
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push(`/compras/${id}`)} className="text-gray-400 hover:text-gray-600 text-sm">← Volver</button>
          <h1 className="text-2xl font-semibold text-gray-800">Editar Orden de Compra</h1>
        </div>

        {/* CABECERA */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Datos generales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Proveedor *</label>
              <select value={cabecera.proveedor_id} onChange={e => setCabecera({ ...cabecera, proveedor_id: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">— seleccione proveedor —</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social} · {p.rut}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fecha *</label>
              <input type="date" value={cabecera.fecha} onChange={e => setCabecera({ ...cabecera, fecha: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Condición de pago</label>
              <select value={cabecera.condicion_pago_id} onChange={e => setCabecera({ ...cabecera, condicion_pago_id: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">— seleccione —</option>
                {condicionesPago.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Moneda</label>
              <select value={cabecera.moneda} onChange={e => setCabecera({ ...cabecera, moneda: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
                <option value="UF">UF</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Observaciones</label>
              <input value={cabecera.observaciones} onChange={e => setCabecera({ ...cabecera, observaciones: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        {/* ITEMS */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Ítems</h2>
          <div className="flex gap-3 mb-4">
            <select value={bienSeleccionado} onChange={e => setBienSeleccionado(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">— seleccione bien o servicio —</option>
              {bienes.map(b => <option key={b.id} value={b.id}>{b.codigo} · {b.descripcion}</option>)}
            </select>
            <button onClick={agregarItem} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
              + Agregar
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No hay ítems</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{['Descripción', 'Unidad', 'Cantidad', 'Precio unit.', 'Subtotal', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-t border-gray-50">
                    <td className="px-3 py-2">
                      <input value={item.descripcion} onChange={e => actualizarItem(idx, 'descripcion', e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{item.bien?.unidad || '—'}</td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.cantidad} min="0" step="0.01"
                        onChange={e => actualizarItem(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                        className="w-24 border border-gray-200 rounded px-2 py-1 text-xs text-right" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.precio_unitario} min="0"
                        onChange={e => actualizarItem(idx, 'precio_unitario', parseFloat(e.target.value) || 0)}
                        className="w-28 border border-gray-200 rounded px-2 py-1 text-xs text-right" />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-right text-gray-700">{fmt(item.subtotal)}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => eliminarItem(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* TOTALES */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Total neto</span>
                <span className="font-mono">{fmt(totalNeto)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>Impuestos</span>
                <span className="font-mono">0</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-gray-800 border-t border-gray-100 pt-2">
                <span>Total</span>
                <span className="font-mono">{fmt(totalNeto)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ACCIONES */}
        <div className="flex justify-end gap-3">
          <button onClick={() => router.push(`/compras/${id}`)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}