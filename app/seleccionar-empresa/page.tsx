'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useEmpresa } from '../context/empresa'

export default function SeleccionarEmpresaPage() {
  const { empresas, empresaActual, setEmpresaActual } = useEmpresa()
  const router = useRouter()

  useEffect(() => {
    if (empresaActual) router.push('/entidades')
  }, [empresaActual])

  function seleccionar(empresa: any) {
    setEmpresaActual(empresa)
    router.push('/entidades')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-gray-100 p-8 w-full max-w-md shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">FINDOS</h1>
          <p className="text-sm text-gray-400 mt-1">Selecciona la empresa con la que deseas operar</p>
        </div>

        <div className="flex flex-col gap-3">
          {empresas.map(empresa => (
            <button key={empresa.id} onClick={() => seleccionar(empresa)}
              className="text-left p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors">
              <div className="font-medium text-gray-800">{empresa.nombre_comercial || empresa.nombre}</div>
              <div className="text-xs text-gray-400 mt-1 font-mono">{empresa.rut}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}