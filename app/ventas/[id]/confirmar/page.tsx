'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface PV {
  id: string
  numero: string
  fecha: string
  estado: string
  moneda: string
  cliente_id: string
  entidades?: { razon_social: string; rut: string }
}

interface PvCondicion {
  id: string
  item_id: string | null
  condicion_precio_id: string
  nivel: string
  valor: number
  monto_calculado: number
  tipo: string
  forma_calculo: string
  condiciones_precio?: {
    nombre: string
    abreviatura: string
    tipo: string
    forma_calculo: string
  }
}

interface ItemConfirmar {
  id: string
  numero_item: number
  descripcion: string
  codigo: string
  unidad: string
  cantidad_original: number
  cantidad_confirmada: number
  cantidad_pendiente: number
  precio_unitario: number
  subtotal_bruto: number
  monto_pendiente: number
  monto_a_confirmar: number
  cuenta_id: string | null
  condiciones: PvCondicion[]
  es_servicio_global: boolean
}

export default function ConfirmarPVPage() {
  const { id } = useParams()
  const router = useRouter()

  const [pvSeleccionado, setPvSeleccionado] = useState<PV | null>(null)
  const [items, setItems] = useState<ItemConfirmar[]>([])
  const [condicionesCabecera, setCondicionesCabecera] = useState<PvCondicion[]>([])
  const [hes, setHes] = useState('')

  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargarPV() }, [id])

  async function cargarPV() {
    setLoading(true)

    const [pvData, itemsData, condsData, condsCabeceraData] = await Promise.all([
      supabase
        .from('pedidos_venta')
        .select('*, entidades(razon_social, rut)')
        .eq('id', id)
        .eq('estado', 'emitida')
        .eq('documento_abierto', true)
        .single(),
      supabase
        .from('pedidos_venta_items')
        .select('*, bienes_servicios(codigo, unidad)')
        .eq('pedido_venta_id', id)
        .order('numero_item'),
      supabase
        .from('pv_condiciones')
        .select('*, condiciones_precio(nombre, abreviatura, tipo, forma_calculo)')
        .eq('pedido_venta_id', id),
      supabase
        .from('pv_condiciones')
        .select('*, condiciones_precio(nombre, abreviatura, tipo, forma_calculo)')
        .eq('pedido_venta_id', id)
        .is('item_id', null)
    ])

    if (!pvData.data) {
      alert('PV no encontrado o no está emitido')
      router.push('/ventas')
      return
    }

    setPvSeleccionado(pvData.data as PV)

    if (itemsData.data) {
      const itemsConDetalle = await Promise.all(itemsData.data.map(async (i: any) => {
        const esServicioGlobal = i.bienes_servicios?.unidad === 'Servicio Global'

        let montoPendiente = i.precio_unitario
        if (esServicioGlobal) {
          const { data: confsActivas } = await supabase
            .from('pv_confirmaciones_items')
            .select('subtotal_bruto_conf, pv_confirmaciones!inner(estado)')
            .eq('item_id', i.id)
            .neq('pv_confirmaciones.estado', 'anulada')
          const montoYaConfirmado = (confsActivas || []).reduce((sum: number, c: any) => sum + c.subtotal_bruto_conf, 0)
          montoPendiente = i.precio_unitario - montoYaConfirmado
        }

        const cantidadYaConfirmada = i.cantidad_confirmada || 0
        const cantidadPendiente = esServicioGlobal ? 1 : i.cantidad - cantidadYaConfirmada

        return {
          id: i.id,
          numero_item: i.numero_item || 0,
          descripcion: i.descripcion,
          codigo: i.bienes_servicios?.codigo || '—',
          unidad: i.bienes_servicios?.unidad || '—',
          cantidad_original: i.cantidad,
          cantidad_confirmada: esServicioGlobal ? 1 : 0,
          cantidad_pendiente: cantidadPendiente,
          precio_unitario: i.precio_unitario,
          subtotal_bruto: i.subtotal,
          monto_pendiente: montoPendiente,
          monto_a_confirmar: 0,
          cuenta_id: i.cuenta_id,
          es_servicio_global: esServicioGlobal,
          condiciones: (condsData.data || []).filter((c: any) => c.item_id === i.id).map((c: any) => ({
            ...c,
            tipo: c.condiciones_precio?.tipo || c.tipo,
            forma_calculo: c.condiciones_precio?.forma_calculo || c.forma_calculo
          }))
        }
      }))
      setItems(itemsConDetalle)
    }

    if (condsCabeceraData.data) {
      setCondicionesCabecera(condsCabeceraData.data.map((c: any) => ({
        ...c,
        tipo: c.condiciones_precio?.tipo || c.tipo,
        forma_calculo: c.condiciones_precio?.forma_calculo || c.forma_calculo
      })))
    }

    setLoading(false)
  }

  function actualizarCantidadConfirmada(idx: number, cantidad: number) {
    const nuevos = [...items]
    const maxPendiente = nuevos[idx].cantidad_pendiente
    nuevos[idx].cantidad_confirmada = Math.min(Math.max(0, cantidad), maxPendiente)
    setItems(nuevos)
  }

  function actualizarMontoAConfirmar(idx: number, monto: number) {
    const nuevos = [...items]
    const maxMonto = nuevos[idx].monto_pendiente
    nuevos[idx].monto_a_confirmar = Math.min(Math.max(0, monto), maxMonto)
    setItems(nuevos)
  }

  function calcularMontoConfirmacion(item: ItemConfirmar) {
  const subtotal_bruto_conf = item.es_servicio_global
    ? item.monto_a_confirmar
    : item.cantidad_confirmada * item.precio_unitario

  const proporcion = item.es_servicio_global
    ? item.monto_a_confirmar / item.precio_unitario
    : item.cantidad_confirmada / item.cantidad_original

  let ajustes_item = 0
  item.condiciones.forEach(c => {
    let monto = 0
    if (c.forma_calculo === 'porcentual') monto = subtotal_bruto_conf * c.valor / 100
    else if (c.forma_calculo === 'monto_fijo') monto = c.valor * proporcion
    else if (c.forma_calculo === 'monto_unidad') monto = c.valor * (item.es_servicio_global ? 1 : item.cantidad_confirmada)
    if (c.tipo === 'descuento') ajustes_item -= monto
    else ajustes_item += monto
  })

  let ajustes_cabecera = 0
  condicionesCabecera.forEach(c => {
    let monto = 0
    if (c.forma_calculo === 'porcentual') monto = subtotal_bruto_conf * c.valor / 100
    else if (c.forma_calculo === 'monto_fijo') monto = c.valor * proporcion
    else if (c.forma_calculo === 'monto_unidad') monto = c.valor * (item.es_servicio_global ? 1 : item.cantidad_confirmada)
    if (c.tipo === 'descuento') ajustes_cabecera -= monto
    else ajustes_cabecera += monto
  })

  return {
    subtotal_bruto: subtotal_bruto_conf,
    descuentos_item: ajustes_item,
    descuentos_cabecera: ajustes_cabecera,
    subtotal_neto: subtotal_bruto_conf + ajustes_item + ajustes_cabecera
  }
}

  const fmt = (n: number) => new Intl.NumberFormat('es-CL').format(Math.round(n))

  function tieneAlgoAConfirmar() {
    return items.some(i => i.es_servicio_global ? i.monto_a_confirmar > 0 : i.cantidad_confirmada > 0)
  }

  async function generarNumeroConfirmacion() {
    const { data } = await supabase
      .from('pv_confirmaciones')
      .select('numero_confirmacion')
      .order('numero_confirmacion', { ascending: false })
      .limit(1)

    if (data && data.length > 0) {
      const ultimo = parseInt(data[0].numero_confirmacion.split('-')[1] || '0')
      return `CV-${String(ultimo + 1).padStart(6, '0')}`
    }
    return 'CV-000001'
  }

  async function guardarConfirmacion() {
    if (!pvSeleccionado) return alert('PV no válido')
    if (!hes.trim()) return alert('El N. Conf. Cliente (HES) es obligatorio')
    if (!tieneAlgoAConfirmar()) return alert('Confirma al menos 1 unidad o monto')
    setGuardando(true)

    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()
    const numero_confirmacion = await generarNumeroConfirmacion()

    const { data: confData, error: confError } = await supabase
      .from('pv_confirmaciones')
      .insert([{
        numero_confirmacion,
        pedido_venta_id: pvSeleccionado.id,
        hes: hes.trim(),
        estado: 'pending_factura',
        fecha_confirmacion: new Date().toISOString(),
        created_by: user?.email,
        updated_by: user?.email,
        updated_at: ahora
      }])
      .select()

    if (confError || !confData) {
      alert('Error: ' + confError?.message)
      setGuardando(false)
      return
    }

    const confirmacion_id = confData[0].id
    let numeroItemConf = 0

    for (const item of items) {
      const tieneConfirmacion = item.es_servicio_global
        ? item.monto_a_confirmar > 0
        : item.cantidad_confirmada > 0

      if (!tieneConfirmacion) continue

      numeroItemConf++
      const montos = calcularMontoConfirmacion(item)

      await supabase.from('pv_confirmaciones_items').insert([{
        confirmacion_id,
        item_id: item.id,
        numero_item: numeroItemConf,
        cantidad_confirmada: item.es_servicio_global ? 1 : item.cantidad_confirmada,
        cantidad_pendiente_original: item.cantidad_original,
        subtotal_bruto_conf: montos.subtotal_bruto,
        monto_descuentos_item: montos.descuentos_item,
        monto_descuentos_global: montos.descuentos_cabecera,
        subtotal_neto_conf: montos.subtotal_neto,
        cuenta_item: item.cuenta_id,
        created_by: user?.email,
        updated_at: ahora
      }])

      if (!item.es_servicio_global) {
        const cantidadTotalAhora = (item.cantidad_original - item.cantidad_pendiente) + item.cantidad_confirmada
        await supabase.from('pedidos_venta_items').update({
          cantidad_confirmada: cantidadTotalAhora,
          updated_at: ahora
        }).eq('id', item.id)
      }
    }

    alert(`Confirmación ${numero_confirmacion} creada exitosamente`)
    setGuardando(false)
    router.push(`/ventas/${pvSeleccionado.id}`)
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push(`/ventas/${id}`)} className="text-gray-400 hover:text-gray-600 text-sm">← Volver</button>
          <h1 className="text-2xl font-semibold text-gray-800">Confirmar Pedido de Venta</h1>
        </div>

        {pvSeleccionado && (
          <>
            {/* CABECERA PV */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{pvSeleccionado.numero}</h2>
                  <p className="text-sm text-gray-600">{pvSeleccionado.entidades?.razon_social}</p>
                </div>
              </div>
            </div>

            {/* HES OBLIGATORIO */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
              <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">N. Conf. Cliente (HES)</h2>
              <input
                type="text"
                placeholder="Ingrese el número de confirmación del cliente *"
                value={hes}
                onChange={e => setHes(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 ${
                  !hes.trim() ? 'border-red-200 bg-red-50' : 'border-gray-200'
                }`}
              />
              {!hes.trim() && (
                <p className="text-xs text-red-500 mt-1">Este campo es obligatorio para crear la confirmación</p>
              )}
            </div>

            {/* ÍTEMS */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
              <h2 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Ítems a confirmar</h2>
              <div className="space-y-4">
                {items.map((item, idx) => {
                  const montos = calcularMontoConfirmacion(item)
                  const hayConfirmacion = item.es_servicio_global ? item.monto_a_confirmar > 0 : item.cantidad_confirmada > 0
                  return (
                    <div key={item.id} className="border border-gray-100 rounded-lg p-4">

                      {item.es_servicio_global && (
                        <div className="mb-3 px-2 py-1 bg-amber-50 border border-amber-100 rounded text-xs text-amber-700">
                          Servicio Global — confirma por monto parcial
                        </div>
                      )}

                      <div className="grid grid-cols-12 gap-2 mb-3">
                        <div className="col-span-1">
                          <label className="text-xs text-gray-400 block mb-1">PV #</label>
                          <p className="text-xs font-semibold text-blue-600">{item.numero_item}</p>
                        </div>
                        <div className="col-span-1">
                          <label className="text-xs text-gray-400 block mb-1">Código</label>
                          <p className="text-xs font-mono text-gray-600">{item.codigo}</p>
                        </div>
                        <div className="col-span-3">
                          <label className="text-xs text-gray-400 block mb-1">Descripción</label>
                          <p className="text-xs text-gray-700">{item.descripcion}</p>
                        </div>
                        <div className="col-span-1">
                          <label className="text-xs text-gray-400 block mb-1">Unidad</label>
                          <p className="text-xs text-gray-600">{item.unidad}</p>
                        </div>
                        <div className="col-span-1">
                          <label className="text-xs text-gray-400 block mb-1">{item.es_servicio_global ? 'Total' : 'Precio u.'}</label>
                          <p className="text-xs font-mono text-gray-600">{fmt(item.precio_unitario)}</p>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-400 block mb-1">{item.es_servicio_global ? 'Monto pendiente' : 'Pendiente'}</label>
                          <p className="text-xs font-mono text-gray-600">
                            {item.es_servicio_global ? fmt(item.monto_pendiente) : item.cantidad_pendiente}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-400 block mb-1">{item.es_servicio_global ? 'Monto a confirmar' : 'Confirmar'}</label>
                          {item.es_servicio_global ? (
                            <input
                              type="number"
                              min="0"
                              max={item.monto_pendiente}
                              value={item.monto_a_confirmar}
                              onChange={e => actualizarMontoAConfirmar(idx, parseFloat(e.target.value) || 0)}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right"
                            />
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max={item.cantidad_pendiente}
                              value={item.cantidad_confirmada}
                              onChange={e => actualizarCantidadConfirmada(idx, parseFloat(e.target.value) || 0)}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right"
                            />
                          )}
                        </div>
                        <div className="col-span-1">
                          <label className="text-xs text-gray-400 block mb-1">Neto</label>
                          <p className="text-xs font-mono font-medium text-gray-700">{fmt(montos.subtotal_neto)}</p>
                        </div>
                      </div>

                      {hayConfirmacion && (
                        <div className="bg-gray-50 rounded p-2 text-xs">
                          <div className="grid grid-cols-2 gap-2 mb-1">
                            <span className="text-gray-600">Subtotal bruto:</span>
                            <span className="text-right font-mono text-gray-700">{fmt(montos.subtotal_bruto)}</span>
                          </div>
                          {montos.descuentos_item !== 0 && (
  <div className="grid grid-cols-2 gap-2 mb-1">
    <span className="text-gray-600">{montos.descuentos_item < 0 ? '- Ajuste ítem:' : '+ Ajuste ítem:'}</span>
    <span className="text-right font-mono text-gray-700">{fmt(Math.abs(montos.descuentos_item))}</span>
  </div>
)}
{montos.descuentos_cabecera !== 0 && (
  <div className="grid grid-cols-2 gap-2 mb-1">
    <span className="text-gray-600">{montos.descuentos_cabecera < 0 ? '- Ajuste global:' : '+ Ajuste global:'}</span>
    <span className="text-right font-mono text-gray-700">{fmt(Math.abs(montos.descuentos_cabecera))}</span>
  </div>
)}
                          <div className="border-t border-gray-200 pt-1 grid grid-cols-2 gap-2">
                            <span className="text-gray-700 font-medium">= Neto:</span>
                            <span className="text-right font-mono font-medium text-gray-800">{fmt(montos.subtotal_neto)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => router.push(`/ventas/${id}`)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">
                Cancelar
              </button>
              <button
                onClick={guardarConfirmacion}
                disabled={guardando || !tieneAlgoAConfirmar() || !hes.trim()}
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar Confirmación'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}