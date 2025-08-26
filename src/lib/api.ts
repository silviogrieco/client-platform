export interface PublicKeyResponse {
  n: string;
  g: string;
  pk_fingerprint: string;
}

const API_BASE = import.meta.env.VITE_API_URL
const API_BASE_1 = import.meta.env.VITE_API_URL_1

export type ElectionPublicKey = { n: string; g: string; pk_fingerprint: string };

export async function createElectionKeys(electionId: number): Promise<ElectionPublicKey> {
  const res = await fetch(`${API_BASE_1}elections`, { 
    method: 'POST',
    headers : { 'Content-Type':'application/json' },
    body: JSON.stringify({votazione_id: electionId})
  });
  if (!res.ok) throw new Error('Impossibile creare le chiavi per la votazione');
  return res.json();
}

export async function submitEncryptedVote(
  electionId: number,
  ciphertext: string,
  numUtenti: number,
  topic: string,

) {
  const res = await fetch(`${API_BASE}elections/vote`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({votazione_id: electionId, ciphertext: ciphertext, topic: topic, num_utenti: numUtenti})
  });
  if (!res.ok) throw new Error('Invio voto fallito');
  return res.json();
}

export interface ResultResponse {
  status: string
}

export async function getResult(votazioneId: number, numUtenti: number): Promise<ResultResponse> {
    const res = await fetch(`${API_BASE}elections/result`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({votazione_id: votazioneId, num_utenti: numUtenti})
  });
  if (!res.ok) throw new Error(`Errore recupero risultati: ${res.status}`);
  return res.json();
}

// New types for admin functionality
export type User = { 
  id: string; 
  nome: string; 
  cognome: string; 
  categoria: string; 
  is_admin?: boolean; 
};

export type VoteModel = { 
  id: number; 
  topic: string; 
  categoria: string; 
  concluded: boolean; 
};

export type SimulationStart = { 
  count: number; 
  categoria?: string; 
  topic?: string; 
};

export type SimulationResponse = {
  simulation_id: number;
  categoria: string;
  votazione_id: number;
  generated_users: User[];
  result: { "Totale SI": number; "Totale NO": number; "Totale voti": number };
};

// User management endpoints
export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}elections/users`);
  if (!res.ok) throw new Error('Impossibile caricare gli utenti');
  return res.json();
}

export async function updateUserCategory(userId: string, categoria: string): Promise<void> {
  const res = await fetch(`${API_BASE}elections/users/category`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({user_id: userId, categoria: categoria })
  });
  if (!res.ok) throw new Error('Impossibile aggiornare la categoria');
}

export async function deleteUser(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}elections/users/delete_user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({user_id: userId })
  });
  if (!res.ok) throw new Error(`Impossibile eliminare l'utente: ${res.status}`);
}

// Get unique categories from users
export async function getCategories(): Promise<string[]> {
  const users = await getUsers();
  const categories = [...new Set(users.map(u => u.categoria).filter(Boolean))];
  return categories;
}

// Votazioni endpoint
export async function getAllVotazioni(): Promise<VoteModel[]> {
  const res = await fetch(`${API_BASE}elections/votazioni`);
  if (!res.ok) throw new Error('Impossibile caricare le votazioni');
  return res.json();
}

// Simulation endpoints
export async function startSimulation(data: SimulationStart): Promise<SimulationResponse> {
  const res = await fetch(`${API_BASE}simulation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Impossibile avviare la simulazione');
  return res.json();
}

export async function endSimulation(simulationId: number): Promise<void> {
  const res = await fetch(`${API_BASE}simulation/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({simulation_id: simulationId})
  });
  if (!res.ok) throw new Error('Impossibile terminare la simulazione');
}

export async function newCategoria(nome: string): Promise<void>{
  const res = await fetch(`${API_BASE}/categoria`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({nome: nome})
  });
  if (!res.ok) throw new Error('Impossibile creare la categoria');
}

  
  export async function newElection(topic: string, categoria: string): Promise<VoteModel>{
    const res = await fetch(`${API_BASE}/elections/insert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({topic: topic, categoria: categoria})
    });
    if (!res.ok) throw new Error('Impossibile creare la categoria');
    return res.json()
}

  export async function deleteElection(votazione_id: Number): Promise<void>{
    const res = await fetch(`${API_BASE}/elections/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({votazione_id: votazione_id})
    });
    if (!res.ok) throw new Error('Impossibile creare la categoria');
    return res.json()
}