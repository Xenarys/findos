'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

interface Empresa {
  id: string
  nombre: string
  nombre_comercial: string
  rut: string
}

interface EmpresaContextType {
  empresaActual: Empresa | null
  empresas: Empresa[]
  setEmpresaActual: (empresa: Empresa) => void
}

const EmpresaContext = createContext<EmpresaContextType>({
  empresaActual: null,
  empresas: [],
  setEmpresaActual: () => {}
})

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaActual, setEmpresaActualState] = useState<Empresa | null>(null)

  useEffect(() => {
    cargarEmpresas()
    const guardada = localStorage.getItem('empresa_actual')
    if (guardada) setEmpresaActualState(JSON.parse(guardada))
  }, [])

  async function cargarEmpresas() {
    const { data } = await supabase.from('empresas').select('*').eq('activo', true).order('nombre')
    if (data) setEmpresas(data)
  }

  function setEmpresaActual(empresa: Empresa) {
    setEmpresaActualState(empresa)
    localStorage.setItem('empresa_actual', JSON.stringify(empresa))
  }

  return (
    <EmpresaContext.Provider value={{ empresaActual, empresas, setEmpresaActual }}>
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  return useContext(EmpresaContext)
}