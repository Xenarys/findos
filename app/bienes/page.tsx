'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface BienServicio {
  id: string
  codigo: string
  descripcion: string
  tipo: string
  clasificacion: string
  unidad: string
  moneda: string
  activo: boolean
}

const formInicial = {
  descripcion: '', tipo: 'servicio',
  clasificacion: '', unidad: '', moneda: 'CLP',
  afecto_iva_compra: true,
  afecto_iva_venta: true
}

export default function BienesPage() {
  const [items, setItems] = useState<BienServicio[]>([])
  const [clasificaciones, setClasificaciones] = useState<string[]>([])
  const [unidades, setUnidades] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState<BienServicio | null>(null)
  const [form, setForm] = useState(formInicial)

  useEffect(() => {
    cargarItems()
    cargarListas()
  }, [])

  async function cargarListas() {
    const { data: clases } = await supabase.from('clasificaciones').select('nombre').eq('activo', true).order('nombre')
    const { data: units } = await supabase.from('unidades').select('nombre').eq('activo', true).order('nombre')
    if (clases) setClasificaciones(clases.map(c => c.nombre))
    if (units) setUnidades(units.map(u => u.nombre))
  }

  async function cargarItems() {
    setLoading(true)
    const { data, error } = await supabase
      .from('bienes_servicios')
      .select('*')
      .order('codigo')
    if (!error && data) setItems(data)
    setLoading(false)
  }

  async function generarCodigo(tipo: string) {
    const prefijo = tipo === 'servicio' ? 'SRV' : 'MAT'
    const { data } = await supabase
      .from('bienes_servicios')
      .select('codigo')
      .like('codigo', `${prefijo}-%`)
      .order('codigo', { ascending: false })
      .limit(1)
    
    let numero = 1
    if (data && data.length > 0) {
      const ultimoCodigo = data[0].codigo
      const ultimoNumero = parseInt(ultimoCodigo.split('-')[1])
      numero = ultimoNumero + 1
    }
    return `${prefijo}-${String(numero).padStart(5, '0')}`
  }

  function abrirEditar(item: BienServicio) {
    setEditando(item)
    setForm({
      descripcion: item.descripcion,
      tipo: item.tipo,
      clasificacion: item.clasificacion || '',
      unidad: item.unidad || '',
      moneda: item.moneda || 'CLP'
    })
    setMostrarForm(true)
  }

  async function guardar() {
    if (!form.descripcion) return alert('La descripción es obligatoria')
    if (!form.clasificacion) return alert('La clasificación es obligatoria')
    if (!form.unidad) return alert('La unidad es obligatoria')

    if (editando) {
      const { error } = await supabase.from('bienes_servicios').update(form).eq('id', editando.id)
      if (error) return alert('Error: ' + error.message)
    } else {
      const codigo = await generarCodigo(form.tipo)
      const { error } = await supabase.from('bienes_servicios').insert([{ ...form, codigo }])
      if (error) return alert('Error: ' + error.message)
    }

    setMostrarForm(false)
    setEditando(null)
    setForm(formInicial)
    cargarItems()
  }

  const itemsFiltrados = items.filter(i => {
    const matchBusqueda = i.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
      i.codigo.toLowerCase().includes(busqueda.toLowerCase())
    const matchFiltro = filtro === 'todos' || i.tipo === filtro
    return matchBusqueda && matchFiltro
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Bienes y Servicios</h1>
            <p className="text-sm text-gray-500">{items.length} registros</p>
          </div>
          <button onClick={() => { setEditando(null); setForm(formInicial); setMostrarForm(true) }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            + Nuevo
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por código o descripción..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          {['todos', 'servicio', 'material'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-lg text-sm capitalize ${filtro === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
              {f === 'todos' ? 'Todos' : f === 'servicio' ? 'Servicios' : 'Materiales'}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Cargando...</div>
          ) : itemsFiltrados.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No hay registros aún</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Código', 'Descripción', 'Tipo', 'Clasificación', 'Unidad', 'Moneda', 'Estado', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itemsFiltrados.map(item => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.codigo}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{item.descripcion}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${item.tipo === 'servicio' ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'}`}>
                        {item.tipo === 'servicio' ? 'Servicio' : 'Material'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.clasificacion || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{item.unidad || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{item.moneda}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${item.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {item.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => abrirEditar(item)}
                        className="text-xs text-gray-600 border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50 cursor-pointer transition-colors">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* FORMULARIO */}
        {mostrarForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">{editando ? 'Editar' : 'Nuevo'} bien o servicio</h2>
                <button onClick={() => { setMostrarForm(false); setEditando(null); setForm(formInicial) }}
                  className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {editando && (
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Código</label>
                    <input value={editando.codigo} readOnly
                      className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 font-mono text-gray-400" />
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Tipo *</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" value="servicio" checked={form.tipo === 'servicio'}
                        onChange={e => setForm({ ...form, tipo: e.target.value })} />
                      Servicio
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" value="material" checked={form.tipo === 'material'}
                        onChange={e => setForm({ ...form, tipo: e.target.value })} />
                      Material
                    </label>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Descripción *</label>
                  <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Clasificación *</label>
                  <select value={form.clasificacion} onChange={e => setForm({ ...form, clasificacion: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">— seleccione —</option>
                    {clasificaciones.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Unidad *</label>
                  <select value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">— seleccione —</option>
                    {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Moneda</label>
                    <select value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                     <option value="CLP">CLP</option>
                     <option value="USD">USD</option>
                     <option value="UF">UF</option>
                     </select>
                    </div>
                <div className="col-span-2">
                 <label className="text-xs text-gray-500 mb-2 block">IVA</label>
                <div className="flex gap-6">
                 <label className="flex items-center gap-2 text-sm cursor-pointer">
               <input type="checkbox"
                    checked={form.afecto_iva_compra}
                   onChange={e => setForm({ ...form, afecto_iva_compra: e.target.checked })} />
                 Afecto IVA compra
             </label>
             <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox"
                   checked={form.afecto_iva_venta}
                      onChange={e => setForm({ ...form, afecto_iva_venta: e.target.checked })} />
                 Afecto IVA venta
                  </label>
                 </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => { setMostrarForm(false); setEditando(null); setForm(formInicial) }}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                <button onClick={guardar}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editando ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}