import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TicketAssigneeSelect } from '../TicketAssigneeSelect'
import type { UserRef } from '@/data/types'
const { search }=vi.hoisted(()=>({search:vi.fn()}))
vi.mock('@/repositories/tarefasRepo.supabase',()=>({listTaskAssignees:search}))
const user=(id:string,name:string):UserRef=>({id,name,email:`${name}@example.com`,roles:['USUARIO']})
beforeEach(()=>{search.mockReset();Element.prototype.scrollIntoView=vi.fn();vi.stubGlobal('ResizeObserver',class{observe(){} unobserve(){} disconnect(){}})})
describe('task assignee picker',()=>{
  it('retains a selected assignee outside the first page and finds another via server query',async()=>{
    const onChange=vi.fn()
    search.mockResolvedValue([user('outside-2','Carla')])
    render(<TicketAssigneeSelect users={[user('first','Ana')]} selected={user('outside-1','Bruno')} onChange={onChange} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Bruno')
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.change(screen.getByPlaceholderText('Buscar responsável...'),{target:{value:'Carla'}})
    await waitFor(()=>expect(search).toHaveBeenCalledWith('Carla'))
    fireEvent.click(await screen.findByText('Carla'))
    expect(onChange).toHaveBeenCalledWith(user('outside-2','Carla'))
  })
})
