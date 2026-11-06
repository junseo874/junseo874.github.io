# Read-only Unity layout export. Engine scene and importer metadata are authoritative.
require 'yaml'
require 'json'
require 'digest'
require 'fileutils'
ENGINE = ARGV.find { |v| v.start_with?('--engine=') }&.split('=', 2)&.last || '/Users/lee/Desktop/project/Human-Bartender/HumanBartender'
WEB = File.expand_path('..', __dir__)
WRITE = ARGV.include?('--write')
def read_yaml(text)
  YAML.load(text)
end
def blocks(text)
  text.scan(/^--- !u!(\d+) &(-?\d+)[^\n]*\n(.*?)(?=^--- !u!|\z)/m).to_h do |type,id,body|
    [id, {'type'=>type.to_i,'data'=>read_yaml(body).values.first}]
  end
end
def fid(ref); ref && ref['fileID'].to_s; end
def multiply(p,t)
  pos=t.fetch('m_LocalPosition',{});s=t.fetch('m_LocalScale',{'x'=>1,'y'=>1});q=t.fetch('m_LocalRotation',{'z'=>0,'w'=>1})
  angle=2*Math.atan2(q['z']||0,q['w']||1);co=Math.cos(angle);si=Math.sin(angle)
  a=co*s['x'];b=si*s['x'];c=-si*s['y'];d=co*s['y']
  {'x'=>p['x']+p['a']*(pos['x']||0)+p['c']*(pos['y']||0),'y'=>p['y']+p['b']*(pos['x']||0)+p['d']*(pos['y']||0),'z'=>p['z']+(pos['z']||0),
   'a'=>p['a']*a+p['c']*b,'b'=>p['b']*a+p['d']*b,'c'=>p['a']*c+p['c']*d,'d'=>p['b']*c+p['d']*d}
end
@guid={};@meta={};@assets={};@sources={}
Dir.glob(ENGINE+'/Assets/**/*.meta').each do |f|
  g=File.read(f)[/^guid: (\w+)/,1];@guid[g]=f.delete_suffix('.meta') if g
end
def sourced(file)
  text=File.binread(file);@sources[file.delete_prefix(ENGINE+'/')]=Digest::SHA256.hexdigest(text);text
end
def pivot(data,key='pivot')
  alignment=data.fetch('alignment',data.fetch('spriteAlignment',0));return data.fetch(key,{'x'=>0.5,'y'=>0.5}) if alignment==9
  x,y=[[0.5,0.5],[0,1],[0.5,1],[1,1],[0,0.5],[1,0.5],[0,0],[0.5,0],[1,0]][alignment]||[0.5,0.5];{'x'=>x,'y'=>y}
end
def sprite(ref)
  file=@guid[ref && ref['guid']];return nil unless file&.end_with?('.png')
  unless @meta[file]
    m=read_yaml(sourced(file+'.meta'))['TextureImporter'];bytes=File.binread(file);w,h=bytes[16,8].unpack('NN')
    relative=file.delete_prefix(ENGINE+'/Assets/01.Game/03.Content/01.ArtResources/')
    src=relative==file ? 'assets/outside/engine/'+File.basename(file) : 'assets/01.ArtResources/'+relative
    # Layout only: never import engine PNGs over the newer web artwork.
    asset='engine-'+ref['guid'];@assets[asset]={'src'=>src,'w'=>w,'h'=>h,'source'=>file.delete_prefix(ENGINE+'/'),'sha256'=>Digest::SHA256.hexdigest(bytes)}
    frames={}
    frames['21300000']={'x'=>0,'y'=>0,'w'=>w,'h'=>h,'pivot'=>pivot(m,'spritePivot')}
    (m.dig('spriteSheet','sprites')||[]).each do |s|
      r=s['rect'];frames[s['internalID'].to_s]={'x'=>r['x'],'y'=>h-r['y']-r['height'],'w'=>r['width'],'h'=>r['height'],'pivot'=>pivot(s),'name'=>s['name']}
    end
    @meta[file]={'asset'=>asset,'ppu'=>m.fetch('spritePixelsToUnits',100),'frames'=>frames}
  end
  m=@meta[file];f=m['frames'][fid(ref)];raise "Missing slice #{file}:#{fid(ref)}" unless f
  f.merge('asset'=>m['asset'],'ppu'=>m['ppu'])
end
def scene(name)
  all=blocks(sourced(ENGINE+'/Assets/01.Game/01.Scenes/'+name+'.unity'))
  ts=all.select { |_,b| [4,224].include?(b['type']) }.transform_values { |b| b['data'] }
  bygo=ts.to_h { |id,t| [fid(t['m_GameObject']),id] }
  cache={};identity={'x'=>0,'y'=>0,'z'=>0,'a'=>1,'b'=>0,'c'=>0,'d'=>1}
  world=nil
  world=lambda do |id|
    return identity if !id || id=='0'
    return cache[id] if cache[id]
    t=ts.fetch(id)
    unless t['m_LocalPosition']
      instance=all.fetch(fid(t['m_PrefabInstance']))['data'];source=fid(t['m_CorrespondingSourceObject'])
      prefab=blocks(sourced(@guid.fetch(t['m_CorrespondingSourceObject']['guid'])))
      t=Marshal.load(Marshal.dump(prefab.fetch(source)['data']))
      instance['m_Modification']['m_Modifications'].each do |mod|
        next unless fid(mod['target'])==source
        k,axis=mod['propertyPath'].split('.');t[k][axis]=mod['value'].to_f if axis && t[k].is_a?(Hash)
      end
      t['m_Father']=instance['m_Modification']['m_TransformParent']
    end
    cache[id]=multiply(world.call(fid(t['m_Father'])),t)
  end
  path_for=nil
  path_for=lambda do |id|
    t=ts[id];return [] unless t && t['m_LocalPosition']
    path_for.call(fid(t['m_Father']))+[all.dig(fid(t['m_GameObject']),'data','m_Name')]
  end
  loc=lambda { |b| world.call(bygo[fid(b['m_GameObject'])]) }
  label=lambda { |b| all.dig(fid(b['m_GameObject']),'data','m_Name') }
  nodes=[];targets={};actors={};named={};cameras={};colliders=[]
  all.each do |id,block|
    b=block['data'];next unless b['m_GameObject'] && bygo[fid(b['m_GameObject'])]
    t=bygo[fid(b['m_GameObject'])];w=loc.call(b);name=label.call(b)
    if block['type']==212 && (sp=sprite(b['m_Sprite']))
      nodes<<{'id'=>id,'go'=>fid(b['m_GameObject']),'name'=>name,'sprite'=>sp,'layer'=>b['m_SortingLayer'],'layerId'=>b['m_SortingLayerID'],'order'=>b['m_SortingOrder'],'flip'=>b['m_FlipX']==1,'flipY'=>b['m_FlipY']==1,'enabled'=>b['m_Enabled']==1,'active'=>all.dig(fid(b['m_GameObject']),'data','m_IsActive')==1,'ancestry'=>path_for.call(t),'color'=>b['m_Color']}.merge(w)
    end
    if [61,60,58].include?(block['type'])
      colliders<<{'id'=>id,'name'=>name,'type'=>block['type'],'offset'=>b['m_Offset'],'size'=>b['m_Size'],'paths'=>b['m_Points'],'trigger'=>b['m_IsTrigger']==1,'enabled'=>b['m_Enabled']==1}.merge(w)
    end
    next unless block['type']==114
    if b['storySceneId'] && !b['storySceneId'].empty?
      targets[b['storySceneId']]={'id'=>id,'name'=>name,'radius'=>b['interactionRadius']}.merge(w)
    end
    named[b['SpotID']]=w if b['SpotID']
    if b['actors']
      owner=all.values.find { |e| e['type']==114 && fid(e['data']['m_GameObject'])==fid(b['m_GameObject']) && e['data']['storySceneId'] }
      event=owner&.dig('data','storySceneId')
      actors[event]=b['actors'].to_h do |actor|
        r=all.fetch(fid(actor['Renderer']))['data'];sp=sprite(r['m_Sprite']);raise 'Missing actor art' unless sp
        [actor['Id'],{'root'=>world.call(fid(actor['Root'])),'visual'=>loc.call(r),'sprite'=>sp,'rendererId'=>fid(actor['Renderer']),'layer'=>r['m_SortingLayer'],'order'=>r['m_SortingOrder'],'flip'=>r['m_FlipX']==1,'visible'=>actor['VisibleOutsideSession']==1}]
      end if event
    end
    klass=b['m_EditorClassIdentifier'].to_s
    if b['Lens']
      (cameras['views']||=[])<<{'name'=>name,'lens'=>b['Lens'],'enabled'=>b['m_Enabled']==1}.merge(w)
    end
    cameras['elevator']=b.select { |k,_| %w[duration delayDuration cameraReturnTiming logoFadeTiming].include?(k) } if klass.end_with?('::OutsideElevator')
    cameras['options']=b['cameraOptions'] if b['cameraOptions']
    cameras['controller']=b.select { |k,_| %w[baseResolution targetResolution outSideResolution defaultTransitionDuration keepRenderResolutionDuringZoom].include?(k) } if b['outSideResolution']
    cameras['pixel']=b.select { |k,_| k.start_with?('m_') && !%w[m_Script m_GameObject m_CorrespondingSourceObject m_PrefabInstance m_PrefabAsset].include?(k) } if b['m_AssetsPPU']
    cameras['confiner']=fid(b['BoundingShape2D']) if klass.include?('CinemachineConfiner2D')
  end
  ts.each { |id,t| named[path_for.call(id).join('/')]=world.call(id) if t['m_LocalPosition'] }
  {'nodes'=>nodes,'actors'=>actors,'targets'=>targets,'named'=>named,'cameras'=>cameras,'colliders'=>colliders}
end
result={'version'=>1,'scenes'=>{'home'=>scene('Home'),'street'=>scene('OutSide')},'assets'=>@assets,'sources'=>@sources,'spriteSheets'=>@meta.values}
json=JSON.pretty_generate(result)+"\n"
output=WEB+'/data/presentation/engine-world-layout.json'
if WRITE
  File.write(output,json)
  File.write(WEB+'/data/presentation/engine-world-layout.js',"/* Generated by tools/import-engine-world.rb; engine remains read-only. */\nwindow.LUNA_ENGINE_WORLD=#{JSON.generate(result)};\n")
else
  puts json
end
warn "ENGINE_WORLD: #{result['scenes'].transform_values { |s| [s['nodes'].length,s['actors'].length,s['targets'].length] }}; #{@assets.length} sprite metadata records; no artwork copied"
