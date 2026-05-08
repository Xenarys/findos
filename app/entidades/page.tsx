'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Contacto {
  id: string
  nombre: string
  cargo: string
  email: string
  telefono: string
  es_principal: boolean
}

interface Entidad {
  id: string
  razon_social: string
  nombre_comercial: string
  rut: string
  tipo_cliente: boolean
  tipo_proveedor: boolean
  ciudad: string
  direccion: string
  giro: string
  email: string
  telefono: string
  banco: string
  tipo_cuenta: string
  numero_cuenta: string
  moneda_pago: string
  activo: boolean
  contactos: Contacto[]
}

const formInicial = {
  razon_social: '', nombre_comercial: '', rut: '',
  tipo_cliente: false, tipo_proveedor: false,
  direccion: '', ciudad: '', giro: '', email: '', telefono: '',
  banco: '', tipo_cuenta: '', numero_cuenta: '', moneda_pago: 'CLP'
}

export default function EntidadesPage() {
  const [entidades, setEntidades] = useState<Entidad[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [entidadSeleccionada, setEntidadSeleccionada] = useState<Entidad | null>(null)
  const [editando, setEditando] = useState<Entidad | null>(null)
  const [form, setForm] = useState(formInicial)
  const [contactos, setContactos] = useState([
    { nombre: '', cargo: '', email: '', telefono: '', es_principal: true }
  ])

  useEffect(() => { cargarEntidades() }, [])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function cargarEntidades() {
    setLoading(true)
    const { data, error } = await supabase
      .from('entidades')
      .select('*, contactos(*)')
      .order('razon_social')
    if (!error && data) setEntidades(data)
    setLoading(false)
  }

  function abrirEditar(e: Entidad) {
    setEditando(e)
    setForm({
      razon_social: e.razon_social || '',
      nombre_comercial: e.nombre_comercial || '',
      rut: e.rut || '',
      tipo_cliente: e.tipo_cliente,
      tipo_proveedor: e.tipo_proveedor,
      direccion: e.direccion || '',
      ciudad: e.ciudad || '',
      giro: e.giro || '',
      email: e.email || '',
      telefono: e.telefono || '',
      banco: e.banco || '',
      tipo_cuenta: e.tipo_cuenta || '',
      numero_cuenta: e.numero_cuenta || '',
      moneda_pago: e.moneda_pago || 'CLP'
    })
    setContactos(e.contactos?.length > 0
      ? e.contactos.map(c => ({ nombre: c.nombre, cargo: c.cargo || '', email: c.email || '', telefono: c.telefono || '', es_principal: c.es_principal }))
      : [{ nombre: '', cargo: '', email: '', telefono: '', es_principal: true }])
    setEntidadSeleccionada(null)
    setMostrarForm(true)
  }

  async function guardarEntidad() {
    if (!form.razon_social || !form.rut) return alert('RUT y Razón social son obligatorios')
    if (!form.tipo_cliente && !form.tipo_proveedor) return alert('Debe ser Cliente y/o Proveedor')

    if (editando) {
      const { error } = await supabase.from('entidades').update(form).eq('id', editando.id)
      if (error) return alert('Error: ' + error.message)
      await supabase.from('contactos').delete().eq('entidad_id', editando.id)
      const contactosConId = contactos.filter(c => c.nombre).map((c, i) => ({ ...c, entidad_id: editando.id, es_principal: i === 0 || c.es_principal }))
      if (contactosConId.length > 0) await supabase.from('contactos').insert(contactosConId)
    } else {
      const { data, error } = await supabase.from('entidades').insert([form]).select()
      if (error) return alert('Error: ' + error.message)
      const entidadId = data[0].id
      const contactosConId = contactos.filter(c => c.nombre).map((c, i) => ({ ...c, entidad_id: entidadId, es_principal: i === 0 }))
      if (contactosConId.length > 0) await supabase.from('contactos').insert(contactosConId)
    }

    setMostrarForm(false)
    setEditando(null)
    resetForm()
    cargarEntidades()
  }

  function resetForm() {
    setForm(formInicial)
    setContactos([{ nombre: '', cargo: '', email: '', telefono: '', es_principal: true }])
  }

  function agregarContacto() {
    setContactos([...contactos, { nombre: '', cargo: '', email: '', telefono: '', es_principal: false }])
  }

  function actualizarContacto(idx: number, campo: string, valor: string) {
    const nuevos = [...contactos]
    nuevos[idx] = { ...nuevos[idx], [campo]: valor }
    setContactos(nuevos)
  }

  function marcarPrincipal(idx: number) {
    setContactos(contactos.map((c, i) => ({ ...c, es_principal: i === idx })))
  }

  function eliminarContacto(idx: number) {
    const nuevos = contactos.filter((_, i) => i !== idx)
    if (nuevos.length > 0 && !nuevos.some(c => c.es_principal)) nuevos[0].es_principal = true
    setContactos(nuevos)
  }

  const entidadesFiltradas = entidades.filter(e => {
    const matchBusqueda =
      e.razon_social.toLowerCase().includes(busqueda.toLowerCase()) ||
      (e.nombre_comercial || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      e.rut.includes(busqueda)
    const matchFiltro = filtro === 'todos' || (filtro === 'clientes' && e.tipo_cliente) || (filtro === 'proveedores' && e.tipo_proveedor)
    return matchBusqueda && matchFiltro
  })

  const contactoPrincipal = (e: Entidad) => e.contactos?.find(c => c.es_principal) || e.contactos?.[0]

  const nombreMostrar = (e: Entidad) => e.nombre_comercial || e.razon_social

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Clientes y Proveedores</h1>
            <p className="text-sm text-gray-500">{entidades.length} registros</p>
          </div>
          <button onClick={cerrarSesion}
            className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 cursor-pointer transition-colors">
             Cerrar sesión
          </button>
          <button onClick={() => { setEditando(null); resetForm(); setMostrarForm(true) }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            + Nuevo
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o RUT..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          {['todos', 'clientes', 'proveedores'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-lg text-sm capitalize ${filtro === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Cargando...</div>
          ) : entidadesFiltradas.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No hay registros aún</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['RUT', 'Nombre comercial', 'Razón social', 'Tipo', 'Ciudad', 'Contacto principal', 'Estado', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entidadesFiltradas.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.rut}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{e.nombre_comercial || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{e.razon_social}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {e.tipo_cliente && <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">Cliente</span>}
                        {e.tipo_proveedor && <span className="bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full">Proveedor</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.ciudad || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {contactoPrincipal(e) ? (
                        <div>
                          <div className="font-medium text-gray-700">{contactoPrincipal(e)?.nombre}</div>
                          <div className="text-xs text-gray-400">{contactoPrincipal(e)?.email}</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${e.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {e.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setEntidadSeleccionada(e)} className="text-xs text-blue-600 border border-blue-200 px-3 py-1 rounded-full hover:bg-blue-50">Ver</button>
                        <button onClick={() => abrirEditar(e)} className="text-xs text-gray-600 border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50">Editar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* FORMULARIO NUEVO / EDITAR */}
        {mostrarForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">{editando ? 'Editar entidad' : 'Nueva entidad'}</h2>
                <button onClick={() => { setMostrarForm(false); setEditando(null); resetForm() }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Razón social *</label>
                  <input value={form.razon_social} onChange={e => setForm({ ...form, razon_social: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Nombre comercial</label>
                  <input value={form.nombre_comercial} onChange={e => setForm({ ...form, nombre_comercial: e.target.value })}
                    placeholder="Nombre con que se conoce comercialmente"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">RUT *</label>
                  <input value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })}
                    placeholder="76.543.210-8"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Ciudad</label>
                  <input value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Email</label>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Teléfono</label>
                  <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Giro</label>
                  <input value={form.giro} onChange={e => setForm({ ...form, giro: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Dirección</label>
                  <input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2 flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.tipo_cliente} onChange={e => setForm({ ...form, tipo_cliente: e.target.checked })} />
                    Cliente
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.tipo_proveedor} onChange={e => setForm({ ...form, tipo_proveedor: e.target.checked })} />
                    Proveedor
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-xs font-medium text-gray-500 mb-3">Datos bancarios</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Banco</label>
                    <input value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Tipo cuenta</label>
                    <select value={form.tipo_cuenta} onChange={e => setForm({ ...form, tipo_cuenta: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Seleccione</option>
                      <option>Cuenta corriente</option>
                      <option>Cuenta vista</option>
                      <option>Cuenta ahorro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">N° cuenta</label>
                    <input value={form.numero_cuenta} onChange={e => setForm({ ...form, numero_cuenta: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs font-medium text-gray-500">Contactos</p>
                  <button onClick={agregarContacto} className="text-xs text-blue-600 hover:underline">+ Agregar</button>
                </div>
                {contactos.map((c, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 mb-3 p-3 bg-gray-50 rounded-lg relative">
                    <input value={c.nombre} onChange={e => actualizarContacto(i, 'nombre', e.target.value)}
                      placeholder="Nombre *" className="border border-gray-200 rounded px-2 py-1.5 text-sm" />
                    <input value={c.cargo} onChange={e => actualizarContacto(i, 'cargo', e.target.value)}
                      placeholder="Cargo" className="border border-gray-200 rounded px-2 py-1.5 text-sm" />
                    <input value={c.email} onChange={e => actualizarContacto(i, 'email', e.target.value)}
                      placeholder="Email" className="border border-gray-200 rounded px-2 py-1.5 text-sm" />
                    <input value={c.telefono} onChange={e => actualizarContacto(i, 'telefono', e.target.value)}
                      placeholder="Teléfono" className="border border-gray-200 rounded px-2 py-1.5 text-sm" />
                    <div className="col-span-2 flex justify-between items-center">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="radio" checked={c.es_principal} onChange={() => marcarPrincipal(i)} />
                        Contacto principal
                      </label>
                      {contactos.length > 1 && (
                        <button onClick={() => eliminarContacto(i)} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => { setMostrarForm(false); setEditando(null); resetForm() }}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                <button onClick={guardarEntidad}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editando ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DETALLE */}
        {entidadSeleccionada && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold">{nombreMostrar(entidadSeleccionada)}</h2>
                  {entidadSeleccionada.nombre_comercial && (
                    <p className="text-xs text-gray-400">{entidadSeleccionada.razon_social}</p>
                  )}
                  <p className="text-xs text-gray-400 font-mono">{entidadSeleccionada.rut}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => abrirEditar(entidadSeleccionada)}
                    className="text-sm text-blue-600 border border-blue-200 px-3 py-1 rounded-lg hover:bg-blue-50">
                    Editar
                  </button>
                  <button onClick={() => setEntidadSeleccionada(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div><span className="text-xs text-gray-400 block">Ciudad</span>{entidadSeleccionada.ciudad || '—'}</div>
                <div><span className="text-xs text-gray-400 block">Giro</span>{entidadSeleccionada.giro || '—'}</div>
                <div><span className="text-xs text-gray-400 block">Email</span>{entidadSeleccionada.email || '—'}</div>
                <div><span className="text-xs text-gray-400 block">Teléfono</span>{entidadSeleccionada.telefono || '—'}</div>
                <div><span className="text-xs text-gray-400 block">Banco</span>{entidadSeleccionada.banco || '—'}</div>
                <div><span className="text-xs text-gray-400 block">N° cuenta</span>{entidadSeleccionada.numero_cuenta || '—'}</div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-500 mb-3">Contactos</p>
                {entidadSeleccionada.contactos?.map(c => (
                  <div key={c.id} className="flex items-start gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{c.nombre}</span>
                        {c.es_principal && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Principal</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{c.cargo}</div>
                      <div className="text-xs text-gray-500">{c.email} · {c.telefono}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}