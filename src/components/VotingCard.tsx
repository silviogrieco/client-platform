import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

interface VotingCardProps {
  votazione: {
    id: number;
    Topic: string;
    Si: number;
    No: number;
    Num_elettori: number;
    Percentuale_si: number;
    Percentuale_no: number;
  };
  userVote?: boolean | null;
  onVoteSuccess: () => void;
  isVotingClosed?: boolean;
}

export const VotingCard = ({ votazione, userVote, onVoteSuccess, isVotingClosed = false }: VotingCardProps) => {
  const [voting, setVoting] = useState(false);

  const handleVote = async (voto: boolean) => {
    setVoting(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Errore",
          description: "Utente non autenticato",
          variant: "destructive"
        });
        return;
      }

      // Insert user vote
      const { error: voteError } = await supabase
        .from('user_votes')
        .insert({
          user_id: user.id,
          votazione_id: votazione.id,
          voto: voto
        });

      if (voteError) {
        toast({
          title: "Errore",
          description: "Errore durante la registrazione del voto: " + voteError.message,
          variant: "destructive"
        });
        return;
      }

      // Update votazione counts
      const newSi = voto ? votazione.Si + 1 : votazione.Si;
      const newNo = voto ? votazione.No : votazione.No + 1;
      const newNumElettori = votazione.Num_elettori + 1;
      const newPercentualeSi = (newSi / newNumElettori) * 100;
      const newPercentualeNo = (newNo / newNumElettori) * 100;

      const { error: updateError } = await supabase
        .from('Votazioni')
        .update({
          Si: newSi,
          No: newNo,
          Num_elettori: newNumElettori,
          Percentuale_si: newPercentualeSi,
          Percentuale_no: newPercentualeNo
        })
        .eq('id', votazione.id);

      if (updateError) {
        toast({
          title: "Errore",
          description: "Errore durante l'aggiornamento dei risultati: " + updateError.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Voto registrato",
        description: `Hai votato ${voto ? 'Sì' : 'No'} per "${votazione.Topic}"`,
      });

      onVoteSuccess();
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore inaspettato",
        variant: "destructive"
      });
    } finally {
      setVoting(false);
    }
  };

  const totalVotes = votazione.Si + votazione.No;
  const siPercentage = totalVotes > 0 ? (votazione.Si / totalVotes) * 100 : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{votazione.Topic}</CardTitle>
          {userVote !== null && userVote !== undefined && (
            <Badge variant={userVote ? "default" : "secondary"}>
              {userVote ? "Votato Sì" : "Votato No"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Risultati */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Sì: {votazione.Si}</span>
            <span>No: {votazione.No}</span>
          </div>
          <Progress value={siPercentage} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{siPercentage.toFixed(1)}% Sì</span>
            <span>{(100 - siPercentage).toFixed(1)}% No</span>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            Totale votanti: {totalVotes}
          </div>
        </div>

        {/* Bottoni per votare */}
        {!isVotingClosed && userVote === null && (
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => handleVote(true)}
              disabled={voting}
              className="flex-1"
              variant="default"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Vota Sì
            </Button>
            <Button
              onClick={() => handleVote(false)}
              disabled={voting}
              className="flex-1"
              variant="secondary"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Vota No
            </Button>
          </div>
        )}

        {isVotingClosed && (
          <div className="text-center text-sm text-muted-foreground">
            Votazione conclusa
          </div>
        )}

        <div className="pt-2">
          <Button asChild variant="outline">
            <Link to={`/vote/${votazione.id}`}>Vai al voto</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};