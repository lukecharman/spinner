import { useState, useMemo } from 'react';
import { hashRoomCode } from '../room';

interface Props {
  onJoin: (roomId: string, roomName: string) => void;
}

// ~500 common, easy-to-spell English words for generating room codes
const WORDS = [
  'acorn','adept','agent','alder','algae','align','alloy','amber','ample',
  'anchor','angel','anvil','apple','arrow','aspen','atlas','badge','basil',
  'beach','beard','bench','berry','birch','blade','blank','blaze','blend',
  'bloom','board','bonus','booth','bound','brace','brave','bread','brick',
  'brisk','brook','brush','budge','bunch','burst','cabin','cable','camel',
  'candy','cargo','cedar','chain','chalk','champ','charm','chase','chess',
  'chief','chord','cider','cinch','civic','claim','clamp','clash','clasp',
  'cliff','climb','cling','clock','cloth','cloud','clove','coach','coast',
  'cobra','comet','coral','cover','craft','crane','crash','crate','crawl',
  'crazy','creek','crest','crisp','cross','crowd','crown','crush','curve',
  'cycle','dance','delta','denim','depot','depth','derby','diary','digit',
  'dodge','donor','draft','drain','drake','drape','drawn','dream','dress',
  'drift','drink','drove','drums','dusty','dwarf','eager','eagle','earth',
  'easel','elbow','elder','elite','ember','enjoy','entry','envoy','epoch',
  'equal','equip','event','exact','exile','extra','fable','facet','fairy',
  'faith','feast','fence','fiber','field','fifty','finch','flame','flare',
  'flask','fleet','flint','float','flock','flood','flora','floss','flour',
  'flute','focal','focus','force','forge','forum','found','frame','fresh',
  'front','frost','fruit','gamma','gavel','gecko','ghost','giant','glade',
  'glare','gleam','glide','globe','gloss','glyph','goose','grace','graft',
  'grain','grand','grant','grape','grasp','grass','green','grind','grove',
  'guard','guide','guild','gusty','habit','haste','haven','hazel','heart',
  'hedge','helix','hello','herbs','heron','hinge','honey','horse','hotel',
  'house','humor','hyper','ivory','jewel','joker','judge','juice','jumbo',
  'karma','kayak','knack','knelt','knife','knoll','label','lance','lapse',
  'larch','laser','latch','layer','ledge','lemon','level','lever','lifer',
  'light','lilac','linen','links','llama','lodge','logic','lotus','lunar',
  'lunch','lyric','macro','magic','mango','manor','maple','march','marsh',
  'mason','match','maxim','mayor','medal','melon','merge','metal','meter',
  'minor','minty','mirth','mixer','mocha','model','money','moose','moral',
  'motif','motor','mound','mount','mouse','mulch','mural','nerve','nexus',
  'noble','north','notch','novel','nudge','oasis','octet','olive','onion',
  'onset','opera','orbit','organ','otter','outer','outdo','oxide','ozone',
  'panda','panel','panic','paper','paste','patch','pause','peach','pearl',
  'pedal','penny','perch','phase','phone','photo','pilot','pinch','pixel',
  'pizza','plaid','plain','plank','plant','plate','plaza','plumb','plume',
  'plump','plush','point','polar','pouch','pouch','pound','power','press',
  'pride','prism','prize','probe','prone','proof','proud','prune','pulse',
  'purge','quail','qualm','queen','query','quest','queue','quick','quiet',
  'quilt','quota','quote','radar','ranch','range','rapid','raven','razor',
  'reach','realm','rebel','reign','relax','relay','ridge','ripen','rival',
  'river','robin','robot','rocky','rouge','round','route','royal','rugby',
  'ruler','rumor','rural','salsa','sauce','scale','scene','scone','scope',
  'scout','seize','setup','shade','shale','shame','shape','share','shark',
  'sharp','shawl','sheep','sheet','shelf','shell','shift','shine','shirt',
  'shock','shore','sigma','silky','siren','sixty','skate','skill','slate',
  'sleep','slice','slide','slope','smart','smile','smith','smoke','snare',
  'solar','solid','solve','sonar','sonic','space','spare','spark','spear',
  'spice','spine','spoke','spoon','spray','squad','stack','stage','stair',
  'stake','stamp','stand','start','stash','steam','steel','steep','steer',
  'stern','stock','stone','store','storm','stove','strap','straw','strip',
  'study','style','sugar','sunny','super','surge','swamp','swarm','sweep',
  'swift','swing','swirl','sword','syrup','table','tally','tango','tango',
  'tempo','their','theta','thorn','tiger','timer','tinge','toast','token',
  'topaz','torch','total','tower','toxin','trace','track','trade','trail',
  'train','trait','trend','trial','trout','truck','truly','tulip','tuner',
  'turbo','twice','twist','ultra','umbra','under','union','unity','until',
  'upper','urban','usher','utile','utter','valid','valor','valve','vapor',
  'vault','verse','vigor','vinyl','viola','viper','visit','vivid','vocal',
  'voice','voter','vouch','vowel','wagon','water','weave','wedge','whale',
  'wheat','wheel','while','whirl','width','wield','winds','witch','world',
  'worth','wrath','wrist','yacht','yield','youth','zebra','zilch','zippy',
];

function generateCode(): string {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${pick()}-${pick()}-${pick()}`;
}

export function TeamLogin({ onJoin }: Props) {
  const generated = useMemo(() => generateCode(), []);
  const [code, setCode] = useState(generated);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);

    try {
      const roomId = await hashRoomCode(trimmed);
      onJoin(roomId, trimmed);
    } catch (cause) {
      console.error('Unable to join the room.', cause);
      setError('Unable to join this room. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">Spinner</h1>
        <p className="login-subtitle">
          Your generated room code is below. Share it with your team so everyone sees the same data.
        </p>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="login-input"
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="e.g. falcon-maple-quest"
            autoFocus
            maxLength={100}
            disabled={loading}
          />
          <button
            className="login-btn"
            type="submit"
            disabled={!code.trim() || loading}
          >
            {loading ? 'Joining…' : 'Join'}
          </button>
        </form>
        {error && <p className="login-error" role="alert">{error}</p>}
        <p className="login-hint">
          Use the generated code for a new room, or enter an existing one to rejoin your team.
        </p>
      </div>
    </div>
  );
}
