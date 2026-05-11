'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Clase {
  id: string
  numero: number
  nombre: string
  activo: boolean
}

interface Grupo {
  id: string
  clase_id: string
  codigo: string
  nombre: string
  activo: boolean
}

interface Cuenta {
  id: string
  clase_id: string
  grupo_id: string
  codigo: string
  nombre: string
  naturaleza: 'D' | 'A'
  activo: boolean
}

export default function PlanCuentasPage() {
  const [clases, setClases] = useState<Clase[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroClase, setFiltroClase] = useState('todas')
  const [clasesExpandidas, setClasesExpandidas] = useState<Set<string>>(new Set())

  // Modales
  const [modalClases, setModalClases] = useState(false)
  const [modalGrupos, setModalGrupos] = useState(false)
  const [modalCuenta, setModalCuenta] = useState(false)
  const [editandoItem, setEditandoItem] = useState<any>(null)
  const [formNombre, setFormNombre] = useState('')
  const [formNumero, setFormNumero] = useState('')
  const [formGrupo, setFormGrupo] = useState({ clase_id: '', codigo: '', nombre: '' })
  const [formCuenta, setFormCuenta] = useState({ clase_id: '', grupo_id: '', codigo: '', nombre: '', naturaleza: 'D' as 'D' | 'A', activo: true })

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setLoading(true)
    const [cls, grp, cue] = await Promise.all([
      supabase.from('clases_cuenta').select('*').order('numero'),
      supabase.from('grupos_cuenta').select('*').order('codigo'),
      supabase.from('plan_cuentas').select('*').order('codigo'),
    ])
    if (cls.data) {
      setClases(cls.data)
      setClasesExpandidas(new Set(cls.data.map((c: Clase) => c.id)))
    }
    if (grp.data) setGrupos(grp.data)
    if (cue.data) setCuentas(cue.data)
    setLoading(false)
  }

  function toggleClase(id: string) {
    const nuevo = new Set(clasesExpandidas)
    nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id)
    setClasesExpandidas(nuevo)
  }

 async function guardarClase() {
    if (!formNombre || !formNumero) return alert('Número y nombre son obligatorios')
    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()
    if (editandoItem) {
      const { error } = await supabase.from('clases_cuenta').update({ numero: parseInt(formNumero), nombre: formNombre, updated_by: user?.email, updated_at: ahora }).eq('id', editandoItem.id)
      if (error) return alert('Error: ' + (error.code === '23505' ? 'Ya existe una clase con ese número' : error.message))
    } else {
      const { error } = await supabase.from('clases_cuenta').insert([{ numero: parseInt(formNumero), nombre: formNombre, created_by: user?.email, updated_by: user?.email, updated_at: ahora }])
      if (error) return alert('Error: ' + (error.code === '23505' ? 'Ya existe una clase con ese número' : error.message))
    }
    setEditandoItem(null)
    setFormNombre('')
    setFormNumero('')
    cargarTodo()
  }

  async function guardarGrupo() {
    if (!formGrupo.nombre || !formGrupo.codigo || !formGrupo.clase_id) return alert('Todos los campos son obligatorios')
    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()
    if (editandoItem) {
      const { error } = await supabase.from('grupos_cuenta').update({ ...formGrupo, updated_by: user?.email, updated_at: ahora }).eq('id', editandoItem.id)
      if (error) return alert('Error: ' + (error.code === '23505' ? 'Ya existe un grupo con ese código' : error.message))
    } else {
      const { error } = await supabase.from('grupos_cuenta').insert([{ ...formGrupo, created_by: user?.email, updated_by: user?.email, updated_at: ahora }])
      if (error) return alert('Error: ' + (error.code === '23505' ? 'Ya existe un grupo con ese código' : error.message))
    }
    setEditandoItem(null)
    setFormGrupo({ clase_id: '', codigo: '', nombre: '' })
    cargarTodo()
  }

  async function guardarCuenta() {
    if (!formCuenta.codigo || !formCuenta.nombre || !formCuenta.clase_id || !formCuenta.grupo_id) return alert('Todos los campos son obligatorios')
    const { data: { user } } = await supabase.auth.getUser()
    const ahora = new Date().toISOString()
    if (editandoItem) {
      const { error } = await supabase.from('plan_cuentas').update({ ...formCuenta, updated_by: user?.email, updated_at: ahora }).eq('id', editandoItem.id)
      if (error) return alert('Error: ' + (error.code === '23505' ? 'Ya existe una cuenta con ese código' : error.message))
    } else {
      const { error } = await supabase.from('plan_cuentas').insert([{ ...formCuenta, created_by: user?.email, updated_by: user?.email, updated_at: ahora }])
      if (error) return alert('Error: ' + (error.code === '23505' ? 'Ya existe una cuenta con ese código' : error.message))
    }
    setModalCuenta(false)
    setEditandoItem(null)
    setFormCuenta({ clase_id: '', grupo_id: '', codigo: '', nombre: '', naturaleza: 'D', activo: true })
    cargarTodo()
  }

  const cuentasFiltradas = cuentas.filter(c => {
    const matchBusqueda = busqueda === '' ||
      c.codigo.includes(busqueda) ||
      c.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchClase = filtroClase === 'todas' || c.clase_id === filtroClase
    return matchBusqueda && matchClase
  })

  const gruposFiltrados = grupos.filter(g => {
    const matchClase = filtroClase === 'todas' || g.clase_id === filtroClase
    const tieneCuentas = cuentasFiltradas.some(c => c.grupo_id === g.id)
    return matchClase && (busqueda === '' || tieneCuentas)
  })

  const clasesFiltradas = clases.filter(cl => {
    const matchClase = filtroClase === 'todas' || cl.id === filtroClase
    const tieneGrupos = gruposFiltrados.some(g => g.clase_id === cl.id)
    return matchClase && (busqueda === '' || tieneGrupos)
  })

  const coloresClase = [
    'bg-emerald-700', 'bg-blue-600', 'bg-purple-600',
    'bg-green-700', 'bg-orange-600', 'bg-red-700', 'bg-gray-700'
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Plan de Cuentas</h1>
            <p className="text-sm text-gray-500">{cuentas.length} cuentas · {grupos.length} grupos · {clases.length} clases</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setModalClases(true); setEditandoItem(null); setFormNombre(''); setFormNumero('') }}
              className="text-sm border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50">
              Gestionar clases
            </button>
            <button onClick={() => { setModalGrupos(true); setEditandoItem(null); setFormGrupo({ clase_id: '', codigo: '', nombre: '' }) }}
              className="text-sm border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50">
              Gestionar grupos
            </button>
            <button onClick={() => { setModalCuenta(true); setEditandoItem(null); setFormCuenta({ clase_id: '', grupo_id: '', codigo: '', nombre: '', naturaleza: 'D', activo: true }) }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
              + Nueva cuenta
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por código o nombre..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-48" />
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setFiltroClase('todas')}
              className={`px-3 py-2 rounded-lg text-sm ${filtroClase === 'todas' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
              Todas
            </button>
            {clases.map(c => (
              <button key={c.id} onClick={() => setFiltroClase(c.id)}
                className={`px-3 py-2 rounded-lg text-sm ${filtroClase === c.id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                {c.numero}
              </button>
            ))}
          </div>
        </div>

        {/* Plan de cuentas */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Cargando...</div>
        ) : (
          <div className="space-y-2">
            {clasesFiltradas.map((clase, idx) => (
              <div key={clase.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button onClick={() => toggleClase(clase.id)}
                  className={`w-full flex items-center gap-3 px-5 py-3 text-white ${coloresClase[idx % coloresClase.length]}`}>
                  <span className="font-bold text-sm">{clase.numero} — {clase.nombre}</span>
                  <span className="ml-auto text-xs opacity-75">
                    {cuentasFiltradas.filter(c => c.clase_id === clase.id).length} cuentas
                  </span>
                  <span className="text-xs">{clasesExpandidas.has(clase.id) ? '▼' : '▶'}</span>
                </button>

                {clasesExpandidas.has(clase.id) && (
                  <div>
                    {gruposFiltrados.filter(g => g.clase_id === clase.id).map(grupo => (
                      <div key={grupo.id}>
                        <div className="flex items-center gap-3 px-5 py-2 bg-gray-50 border-b border-gray-100">
                          <span className="font-mono text-xs text-blue-600 font-bold w-16">{grupo.codigo}</span>
                          <span className="text-xs font-semibold text-gray-600">{grupo.nombre}</span>
                          <span className="ml-auto text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Grupo</span>
                        </div>
                        {cuentasFiltradas.filter(c => c.grupo_id === grupo.id).map(cuenta => (
                          <div key={cuenta.id}
                            className="flex items-center gap-3 px-5 py-2 border-b border-gray-50 hover:bg-gray-50 group">
                            <span className="font-mono text-xs text-emerald-700 font-semibold w-16 pl-4">{cuenta.codigo}</span>
                            <span className="text-sm text-gray-700 flex-1">{cuenta.nombre}</span>
                            <span className={`text-xs font-bold w-6 text-center ${cuenta.naturaleza === 'D' ? 'text-red-600' : 'text-green-700'}`}>
                              {cuenta.naturaleza}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${cuenta.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                              {cuenta.activo ? 'Activa' : 'Inactiva'}
                            </span>
                            <button onClick={() => {
                              setEditandoItem(cuenta)
                              setFormCuenta({ clase_id: cuenta.clase_id, grupo_id: cuenta.grupo_id, codigo: cuenta.codigo, nombre: cuenta.nombre, naturaleza: cuenta.naturaleza, activo: cuenta.activo })
                              setModalCuenta(true)
                            }} className="text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                              Editar
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* MODAL CLASES */}
        {modalClases && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Gestionar clases</h2>
                <button onClick={() => setModalClases(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Número *</label>
                  <input type="number" value={formNumero} onChange={e => setFormNumero(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
                  <input value={formNombre} onChange={e => setFormNombre(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <button onClick={guardarClase}
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 mb-4">
                {editandoItem ? 'Actualizar' : 'Agregar clase'}
              </button>
              <div className="border-t border-gray-100 pt-4">
                {clases.map(c => (
                  <div key={c.id} className="flex items-center gap-3 py-2 border-b border-gray-50">
                    <span className="font-mono text-sm font-bold text-blue-600 w-6">{c.numero}</span>
                    <span className="text-sm flex-1">{c.nombre}</span>
                    <button onClick={() => { setEditandoItem(c); setFormNumero(String(c.numero)); setFormNombre(c.nombre) }}
                      className="text-xs text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">Editar</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODAL GRUPOS */}
        {modalGrupos && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Gestionar grupos</h2>
                <button onClick={() => setModalGrupos(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Clase *</label>
                  <select value={formGrupo.clase_id} onChange={e => setFormGrupo({ ...formGrupo, clase_id: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">— seleccione —</option>
                    {clases.map(c => <option key={c.id} value={c.id}>{c.numero} — {c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Código *</label>
                  <input value={formGrupo.codigo} onChange={e => setFormGrupo({ ...formGrupo, codigo: e.target.value })}
                    placeholder="Ej: 101"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
                  <input value={formGrupo.nombre} onChange={e => setFormGrupo({ ...formGrupo, nombre: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <button onClick={guardarGrupo}
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 mb-4">
                {editandoItem ? 'Actualizar' : 'Agregar grupo'}
              </button>
              <div className="border-t border-gray-100 pt-4">
                {clases.map(clase => (
                  <div key={clase.id}>
                    <p className="text-xs font-semibold text-gray-400 mt-3 mb-1">{clase.numero} — {clase.nombre}</p>
                    {grupos.filter(g => g.clase_id === clase.id).map(g => (
                      <div key={g.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50">
                        <span className="font-mono text-xs text-blue-600 w-10">{g.codigo}</span>
                        <span className="text-sm flex-1">{g.nombre}</span>
                        <button onClick={() => { setEditandoItem(g); setFormGrupo({ clase_id: g.clase_id, codigo: g.codigo, nombre: g.nombre }) }}
                          className="text-xs text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">Editar</button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODAL CUENTA */}
        {modalCuenta && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">{editandoItem ? 'Editar' : 'Nueva'} cuenta</h2>
                <button onClick={() => { setModalCuenta(false); setEditandoItem(null) }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Clase *</label>
                  <select value={formCuenta.clase_id} onChange={e => setFormCuenta({ ...formCuenta, clase_id: e.target.value, grupo_id: '' })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">— seleccione —</option>
                    {clases.map(c => <option key={c.id} value={c.id}>{c.numero} — {c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Grupo *</label>
                  <select value={formCuenta.grupo_id} onChange={e => setFormCuenta({ ...formCuenta, grupo_id: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">— seleccione —</option>
                    {grupos.filter(g => g.clase_id === formCuenta.clase_id).map(g => (
                      <option key={g.id} value={g.id}>{g.codigo} — {g.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Código *</label>
                  <input value={formCuenta.codigo} onChange={e => setFormCuenta({ ...formCuenta, codigo: e.target.value })}
                    placeholder="Ej: 101010"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Naturaleza *</label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" value="D" checked={formCuenta.naturaleza === 'D'}
                        onChange={() => setFormCuenta({ ...formCuenta, naturaleza: 'D' })} />
                      <span className="text-red-600 font-bold">D</span> Deudora
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" value="A" checked={formCuenta.naturaleza === 'A'}
                        onChange={() => setFormCuenta({ ...formCuenta, naturaleza: 'A' })} />
                      <span className="text-green-700 font-bold">A</span> Acreedora
                    </label>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
                  <input value={formCuenta.nombre} onChange={e => setFormCuenta({ ...formCuenta, nombre: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={formCuenta.activo}
                      onChange={e => setFormCuenta({ ...formCuenta, activo: e.target.checked })} />
                    Cuenta activa
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => { setModalCuenta(false); setEditandoItem(null) }}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg">Cancelar</button>
                <button onClick={guardarCuenta}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editandoItem ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}