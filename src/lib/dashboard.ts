import { useEffect, useState } from 'react';
import { api, errorMessage } from './api';
export function useDashboardData<T>(endpoint:string, params?: Record<string, string|number>) { const [data,setData]=useState<T|null>(null);const [error,setError]=useState('');const key=JSON.stringify(params||{});useEffect(()=>{let active=true;setData(null);setError('');api.get<T>(endpoint,{params}).then(r=>{if(active)setData(r.data)}).catch(e=>{if(active)setError(errorMessage(e))});return()=>{active=false}},[endpoint,key]);return {data,error}; }
