var language = 'english';
const storagePrefix = 'insertStory_';
var profileId = null;

const elemsToSave = [
					'difficulty',
					'dayNumber',
					'characters',
					'backPage',
					'currentLocation',
					'currentPage',
					'villa',
					'timeDay',
					'infoNextDay',
					'playNextDay',
					'trapUsed',
					'probaDream',
					'eventsCooldown',
				];


/******************************/
/********* CLASSES ************/
/******************************/

class Character{
	constructor(params){
		if(params !== undefined){
			this.id = null;
			this.wasMan = false;

			if(params.idChar !== undefined)
				this.id = params.idChar;

			this.gender = 'woman';
			if(params.gender !== undefined && params.gender == 'man')
				this.wasMan = true;

			if(params.hairColor !== undefined)
				this.hairColor = params.hairColor;

			if(params.firstname !== undefined){
				if(this.wasMan){
					this.firstnameMan = params.firstname;
					this.firstname = pickRandom(clone(window.database.characterInfo.femaleNames));
				}else{
					this.firstname = params.firstname;
				}
			}
			if(params.lastname !== undefined)
				this.lastname = params.lastname;

			if(params.archetype !== undefined)
				this.archetype = params.archetype;

			if(params.behavior !== undefined)
				this.behavior = params.behavior;

			this.dateStart = getStorage('dayNumber');
			if(this.id !== 'player'){
				this.findProfile();

				this.stage = 0;
				this.out = false;
			}else{
				this.votes = 0;
				this.matchArchetype();

				this.bimbo = 0;				//Current points
				this.slut = 0;
				this.bimboStage = 1;		//Definitive Stage pass by point threshold
				this.slutStage = 1;
				this.giveState('bimbo');	//Temporaly State according to the current points
				this.giveState('slut');
				this.changeStageDay = 0;	//When the last Stage change

				//Define if you need to buy Improvements
				this.boobsCrave = 0;
				this.makeupCrave = 0;
				this.sexCrave = 0;

				this.cameraUsed = false;
				this.inventory = {};

				this.stats = {
					'masturbated':0,
					'dreams':{},
					'trapSetup':0,
					'trapSuccess':0,
					'trapYourself':0,
					'totalVoteGain':0,
					'totalVoteStoled':0,
					'totalVoteSpend':0,
					'archetypeUsed':{},
					'aimessing':{},
					'soloActivity':{},
					'participateActivity':{},
					'ambush':{},
					'eventOtherEncountered':{},
					'loadgame':0,
					'objectBuy':{},
					'cheats':{},
					'cheatsCurrent':{},
				};
				this.stats.archetypeUsed[this.archetype] = 1;
				this.info = {};

				this.definePseudo();
				this.updateMorning();
			}

			//Choose Set for Activities
				this.activities = this.chooseActivitiesSet();

			//Perks
				if(params.perks !== undefined){
					if(params.perks.length > window.database.creation.perksMax){
						this.perks = ['alpha'];
					}else{
						this.perks = params.perks;
					}
				}

			//Find a profile Pict
			this.giveFace();

			//Generate information
			this.fillInfo();
			this.setUpBody();

			this.save();
		}
	}

	chooseActivitiesSet(){
		let archetypeInfo = window.database.participants[this.archetype];
		let listActivities = [];
		let locations = window.database.locations;
		for(let locaId in locations){
			if(locations[locaId].activities !== undefined){
				listActivities = [...listActivities,...Object.keys(locations[locaId].activities)];
			}
		}
		let activities = {};
		for(let activityId of listActivities){
			if(archetypeInfo.activities !== undefined && archetypeInfo.activities[activityId] !== undefined){
				activities[activityId] = pickRandom(Object.keys(archetypeInfo.activities[activityId]));
			}
		}
		return activities;
	}
	getFormal(force){
		if(this.gender == 'man'||(force !== undefined && force == 'man')){
			return ucfirst(getTrad('peoplestuff.mr'));
		}else{
			if(this.typeBody == 'milf')
				return ucfirst(getTrad('peoplestuff.mrs'));
			else
				return ucfirst(getTrad('peoplestuff.miss'));
		}
	}
	addSchedule(time,actionId){
		let actions = window.database.actions;
		if(this.schedule === undefined)
			this.schedule = {};
		this.schedule[time] = {"id":actionId,"location":actions[actionId].location,"activityId":actions[actionId].activity};
		this.save();
	}
	getCurrentActivity(){
		let time = getStorage('timeDay');
		return this.schedule[time].activityId;
	}
	definePseudo(){
		if(this.gender == 'man'){
			this.pseudo = 'guy';
		}else{
			//Get with condition (first match is kept)
			let pseudoList = window.database.pseudoRanges;
			for(let pseudoId in pseudoList){
				let pseudoData = pseudoList[pseudoId];
				//SlutMin,SlutMax,BimboMin,BimboMax
				if(pseudoData.range !== undefined && pseudoData.range.length > 0){
					if(pseudoData.range[0] > this.slut || this.slut > pseudoData.range[1] ||
						pseudoData.range[2] > this.bimbo || this.bimbo > pseudoData.range[3]
						)
						continue;
				}
				if(pseudoData.perks !== undefined && pseudoData.perks.length > 0){
					let inter = arrayInter(this.perks,pseudoData.perks);
					if(inter.length == 0)
						continue;
				}
				this.pseudo = pseudoId;
				break;
			}			
		}
	}
	getNameDisplay(){
		let pseudoName = ucfirst(getTrad('pseudo.'+this.pseudo));
		if(this.pseudo == 'guy'){
			pseudoName = ucfirst(getTrad('basic.theman'))+' '+ucfirst(getTrad('jobs.'+this.trueJob+'.name'));
			addClass(getId('nameChar'),'normalName');
		}else{
			pseudoName = ucfirst(getTrad('basic.thegirl'))+' '+pseudoName;
			if(this.wasMan && this.pseudo == 'girl'){
				pseudoName += '?!';
			}
			removeClass(getId('nameChar'),'normalName');
		} 
			
		return this.firstname+'<br>'+pseudoName;
	}
	getName(){
		if(this.id == 'player')
			return ucfirst(getTrad('basic.you'));
		else
			return this.firstname+' '+this.lastname;
	}
	giveState(type){
		let value = normalize(this[type] + ( (this[type+'Stage']-1) * 10),0,100);	//If you're at stage 1 => Add 15%
		let ranges = window.database[type+'Ranges'];
		for(let rangeId in ranges){
			let range = ranges[rangeId];
			if(range[0] <= value && value <= range[1]){
				this[type+'State'] = rangeId;
				break;
			}
		}
	}
	getStateProfile(type = 'lasting'){
		let setPict = window.database.participants[this.archetype].profilePicts[this.profilePictsSet];
		let state = 1;
		if(type == 'actual'){	//Try to have picture more dependent of the actual "mood"
			state = normalize(Math.ceil((this.bimbo+this.slut + ((this.bimboStage+this.slutStage-2)*0.10) )/2),0,100) / 100;
			state = Math.round(setPict.length * state);
		}else{
			state = Math.ceil((this.bimboStage+this.slutStage)/2) - 1;
		}
		if(state >= setPict.length)
			state = setPict.length - 1;
		return state;
	}
	saveProfile(state = null){
		if(state !== null){
			this.stateProfile = state;
			this.generateTestimonial();
			this.save();
		}

		this.previousProfile.push(characterDetailsData(this.id));

		this.save();
	}
	changePassion(){
		let behaviorData = window.database.behaviors[this.behavior];
		let arrDiff = arrayDiff(behaviorData.stageChange.addPassion,this.passionsTransformed);
		if(random(0,1)||arrDiff.length == 0){
			let passionsTransition = window.database.passionsTransition;
			let countPassion = this.passions.length;
			let passionExtract = this.passions.splice(random(0,countPassion-1),1);
			if(passionExtract.length > 0 && this.passionsTransformed.indexOf(passionsTransition[passionExtract]) === -1)
				this.passionsTransformed.push(passionsTransition[passionExtract]);
		}else{
			this.passionsTransformed.push(pickRandom(arrDiff));
		}
	}
	addStage(){
		let archetypePicts = window.database.participants[this.archetype].picts;
		let behaviorData = window.database.behaviors[this.behavior];
		let nbStage = window.database.difficulty[getStorage('difficulty')].nbStage;

		//Don't overdo
		if(this.stage == nbStage)
			return false;

		this.stage++;
		if(this.stage == nbStage){
			this.out = true;
			this.dateOut = getStorage('dayNumber');
			this.stage = nbStage;
			this.giveFace();
		}else{
			this.pict = archetypePicts[this.pictList[ this.stage ]];
		}

		//Change Passions or add new one
		this.changePassion();

		//Change IQ
		let totalIqToDelete = (this.startStats.iq-70);
		let iqToDelete = Math.round(totalIqToDelete / nbStage);
		this.iq -= iqToDelete;

		//Change Sexual Pref
		if(random(1,3) == 3||this.sexualPref == 'asexual'){
			let indexNow = behaviorData.stageChange.sexualPref.indexOf(this.sexualpref);
			if(indexNow === -1||indexNow < behaviorData.stageChange.sexualPref.length-1){
				this.sexualpref = behaviorData.stageChange.sexualPref[indexNow+1];
			}
		}

		//Change Testimonial & Album
		this.generateTestimonial();

		this.save();

		//Save new Profile Info
		this.saveProfile();
	}
	generateTestimonial(){
		let tmpTestimonial = {};
		let albumPicture = [];

		//Find parts
		let paths = {
			'start':'profile.testimonial.start',
			'testi':'behaviors.default.testimonial',
			'end':'profile.testimonial.end'
		};
		if(window.translation[language].behaviors[this.behavior] !== undefined){
			if(window.translation[language].behaviors[this.behavior].starttestimonial !== undefined){
				paths.start = 'behaviors.'+this.behavior+'.starttestimonial';
			}
			if(window.translation[language].behaviors[this.behavior].testimonial !== undefined){
				paths.testi = 'behaviors.'+this.behavior+'.testimonial';
			}
			if(window.translation[language].behaviors[this.behavior].endtestimonial !== undefined){
				paths.end = 'behaviors.'+this.behavior+'.endtestimonial';
			}
		}

		for(let part of Object.keys(paths)){
			let path = paths[part];

			let choices = gObj(window.translation[language],path);
			let typeChoice = givePartToUsed(choices,this,'testimonial');

			tmpTestimonial[part] = getTrad(path+'.'+typeChoice,this);
		}

		//Album
		let albumChar = gObj(window.database,'participants.'+ this.get('archetype') +'.album');
		if(albumChar !== undefined && Object.keys(albumChar).length > 0){
			let pictChoice = givePartToUsed(albumChar,this,'album');
			let pictChoosed = pickRandom(albumChar[pictChoice],3);
			for(let pictInfo of pictChoosed){
				albumPicture.push('<div class="album"><img src="'+pictInfo.pict+'"><div class="albumName">'+getTrad(pictInfo.name,this)+'</div></div>');
			}
		}

		//Passions Album
		let arrPassions = arrayConcat(this.passions,this.passionsTransformed);
		for(let passionId of arrPassions){
			if(albumPicture.length < window.database.albumPicture && window.database.album[passionId] !== undefined && window.database.album[passionId].length > 0){
				let pictChoose = pickRandom(window.database.album[passionId]);
				let titleChoose = getTrad('profile.passions.'+passionId);
				albumPicture.push('<div class="album"><img src="'+pictChoose+'"><div class="albumName">'+titleChoose+'</div></div>');
			}
		}
		//Passions Desc
		let passionsKept = pickRandom(arrPassions,random(2,3));
		tmpTestimonial['passions'] = [];
		for(let passionId of passionsKept){
			tmpTestimonial['passions'].push(getTrad('profile.testimonial.passions.'+passionId,this));
		}

		this.testimonial = '<p>'+tmpTestimonial.start+' '+tmpTestimonial.testi+'</p><p>'+tmpTestimonial.passions.join('</p><p>')+'</p><p>'+tmpTestimonial.end+'</p>';

		//Generate Album
		albumPicture = arrayShuffle(albumPicture);
		this.album = albumPicture.join('');
	}
	giveHypnoFace(){
		let nbStage = window.database.difficulty[getStorage('difficulty')].nbStage;
		if(window.database.participants[this.archetype].hypnoPortrait === undefined)
			return '';
		let pictsAvailable = window.database.participants[this.archetype].hypnoPortrait[this.hypnoFaceSet];
		let nameStage = this.pictList[ this.stage ];
		if(nameStage === undefined){
			let keys = Object.keys(this.pictList);
			nameStage = this.pictList[keys[keys.length-1]];
		}
		return pictsAvailable[ nameStage ];
	}
	giveFace(){
		if(this.id == 'player'){
			this.pict = window.database.participants[this.archetype].picts[this.bimboState];
		}else{
			let pictsAvailable = window.database.participants[this.archetype].picts;
			if(this.out){
				this.pict = pictsAvailable.out;
			}else{
				let nbStage = window.database.difficulty[getStorage('difficulty')].nbStage;
				if(this.pictList === undefined){
					let pictsId = Object.keys(pictsAvailable);
					pictsId.splice(pictsId.length-1,1);	//Remove the "out"
					let choosed = pickRandom(pictsId,nbStage);
					this.pictList = arrayInter(pictsId,choosed);
				}
				this.pict = pictsAvailable[ this.pictList[ this.stage ] ];
			}
		}
	}
	addInventory(item){
		let actions = clone(window.database.actions);
		this.inventory[item] = actions[item];
		this.inventory[item].modified = false;
		this.save();
	}
	buyItem(id){
		let buyable = clone(window.database.buyable);
		let price = parseFloat(window.database.difficulty[getStorage('difficulty')].price);

		if(this.inventory[id] === undefined && (buyable[id].quantity !== undefined||buyable[id].stage !== undefined)){
			this.inventory[id] = buyable[id];
		}

		if(this.inventory[id] !== undefined){
			if(this.inventory[id].quantity !== undefined)
				this.inventory[id].quantity += 1;
			if(this.inventory[id].stage !== undefined){
				this.inventory[id].stage += 1;
				if(id == 'boobsenlargement'){
					this.changeCloth('topCloth','increase');
				}
			}
		}

		//Set to the supposed size with augment (after scientistfail)
		if(id == 'boobsrejuv'){
			let sizeBoobs = clone(window.database.boobsSize);
			let sizeBaseArchetype = window.database.participants[this.archetype].sizeBoobs;
			let enlargementLvl = (this.inventory.boobsenlargement !== undefined ? this.inventory.boobsenlargement.stage : 0);
			let missing = sizeBoobs.indexOf(sizeBaseArchetype)+enlargementLvl - sizeBoobs.indexOf(this.sizeBoobs);
			this.changeCloth('topCloth','increase',missing);
		}

		this.votes -= price;

		//Stats
		this.stats.totalVoteSpend += price;
		if(this.stats.objectBuy[id] === undefined)
			this.stats.objectBuy[id] = 0;
		this.stats.objectBuy[id] += 1;

		//Reset the crave
		if(buyable[id].crave !== undefined)
			this[buyable[id].crave] = 0;
		//Reset Stats
		if(buyable[id].reset !== undefined){
			this[buyable[id].reset] = 0;
			this.giveState(buyable[id].reset);
			this.giveFace();
		}

		this.save();
	}
	modItem(id){
		this.inventory[id].modified = true;
		this.save();

		let actions = clone(window.database.actions);
		this.removeInventory(actions[id].object);
	}
	removeInventory(item){
		if(this.inventory[item].quantity !== undefined){
			this.inventory[item].quantity -= 1;
		}else{
			delete this.inventory[item];
		}
		this.save();
	}
	doHave(item){
		if (this.inventory[item] !== undefined && (this.inventory[item].quantity === undefined||this.inventory[item].quantity > 0))
			return this.inventory[item];
		else
			return false;
	}
	giveActivity(id){
		if(this.activities[id] !== undefined){
			let nbStage = window.database.difficulty[getStorage('difficulty')].nbStage;
			let pictsAvailable = window.database.participants[this.archetype].activities[id][this.activities[id]];

			let stageUse = this.stage;
			if(this.id == 'player'){
				if(this.havePerk('exhibitionist')||this.havePerk('naturist')){
					stageUse = pictsAvailable.length-1;
				}else{
					stageUse = this.getStateProfile('actual');
				}
			}
			switch(nbStage == 3){
				case 2:
					switch(stageUse){
						case 1:return pictsAvailable[0];break;
						case 2:return pictsAvailable[3];break;
					}
					break;
				case 3:
					switch(stageUse){
						case 1:return pictsAvailable[0];break;
						case 2:return pictsAvailable[2];break;
						case 3:return pictsAvailable[3];break;
					}
					break;
				default:
					if(stageUse >= 5)
						return pictsAvailable[pictsAvailable.length-1];
					else	
						return pictsAvailable[ stageUse ];
					break;
			}
		}else{
			return false;
		}
	}
	giveExitation(){
		return (this.bimbo+this.slut) / 2;
	}
	getExistingElements(){
		let info = {'namesUsed':[], 'archetypeUsed':[]};
		let characters = getStorage('characters');
		for(let char in characters){
			let charInfo = characters[char];
			info.namesUsed.push(charInfo.firstname+' '+charInfo.lastname);
			if(charInfo.archetype !== undefined)
				info.archetypeUsed.push(charInfo.archetype);
		}
		return info;
	}
	matchArchetype(){

		let participantsData = window.database.participants;
		if(this.archetype === undefined || this.wasMan == true){
			let archetypeAvailable = archetypeDispo();

			let archetypePlayer = [];

			//Check if possible, if nothing match try with less conditions
			let checks = ['typeBody','hairColor','available'];
			while(archetypePlayer.length == 0){
				for(let participantId in participantsData){
					let data = participantsData[participantId];

					if(checks.indexOf('available') !== -1 && archetypeAvailable.indexOf(participantId) === -1)
						continue;

					if(checks.indexOf('hairColor') !== -1 && data.hairColor != this.hairColor)
						continue;

					if(checks.indexOf('typeBody') !== -1 && data.typeBody !== 'petite')
						continue;

					if(data.profilePicts === undefined)
						continue;

					archetypePlayer.push(participantId);
				}

				if(checks.length == 0)
					break;

				checks.splice(0,1);
			}
			this.archetype = pickRandom(archetypePlayer);
		}

		this.trueJob = 'itconsultant';


		this.bottomType = 'normal';
		this.sizeBoobs = participantsData[this.archetype].sizeBoobs;

		//Select the camsPhoto set
		let camsPhotoSets = Object.keys(window.database.participants[this.archetype].camsPhoto);
		this.camsPhotoId = pickRandom(camsPhotoSets);

		//Pick a set of cloth
		let topSets = getClothes('topCloth',this.sizeBoobs);
		this.topCloth = pickRandom(topSets);

		let bottomSets = getClothes('bottomCloth','normal');
		this.bottomCloth = pickRandom(bottomSets);

		this.faceless = pickRandom(window.database.fleshrealmData.facelessPlayer[this.hairColor]);

		this.starting = {
			'archetype':this.archetype,
			'transfoMention':0,				//How many times the IA mention your transformation
		};

		if(this.wasMan){
			this.pictMan = pickRandom(window.database.creation.menProfile[this.hairColor]);
			if(this.starting.face === undefined){
				this.starting.face = this.pictMan;

				let typeTorso = pickRandom(Object.keys(window.database.creation.mentorso));
				this.starting.torsoType = typeTorso;
				this.starting.torsoPict = pickRandom(window.database.creation.mentorso[typeTorso]);

				let typeBottom = pickRandom(Object.keys(window.database.creation.menbottom));
				this.starting.typeBottom = typeBottom;
				this.starting.bottomPict = pickRandom(window.database.creation.menbottom[typeBottom]);
			}
		}else if(this.starting.face === undefined){
			this.starting.face = window.database.participants[this.archetype].picts.base;
			let pictsBoobsList = this.picturesTypes('topCloth');
			this.starting.torsoType = this.sizeBoobs;
			this.starting.torsoPict = pictsBoobsList[pictsBoobsList.length -1];

			let pictsBottomsList = this.picturesTypes('bottomCloth');
			this.starting.typeBottom = this.bottomType;
			this.starting.bottomPict = pictsBottomsList[pictsBottomsList.length -1];
		}
	}
	giveClothImg(type){
		let picts = null;
		if(type == 'bottomCloth'){
			let tmp = this[type].split('_');
			if(tmp.length > 1){
				picts = window.database.cloth[type][tmp[0]][tmp[1]];
			}else{
				picts = window.database.cloth[type][this.bottomType][this[type]];
			}
		}else{
			let tmp = this[type].split('_');
			if(tmp.length > 1){
				picts = window.database.cloth[type][tmp[0]][tmp[1]];
			}else{
				picts = window.database.cloth[type][this.sizeBoobs][this[type]];
			}
		}

		if(picts !== undefined && picts.length > 0){
			if(this.havePerk('exhibitionist')||this.havePerk('naturist')){
				return picts[picts.length-1];
			}else{
				let slutIndice = (this.slut >= 100?99:this.slut);
				let step = Math.round(100 / picts.length);
				let index = Math.floor(slutIndice / step);
				return picts[index];
			}
		}else{
			return false;
		}
	}
	picturesTypes(type,fieldValSet){		//Give the picture of the clothes
		if(fieldValSet === undefined)
			fieldValSet = type;

		let test = this[fieldValSet].split('_');
		if(test.length > 1){
			return window.database.cloth[type][test[0]][test[1]];
		}else{
			let kind = (type == 'topCloth' ? 'sizeBoobs' : 'bottomType');
			if(fieldValSet == 'oldBoobsSet')
				kind = 'oldBoobsSize';
			return window.database.cloth[type][this[kind]][this[fieldValSet]];
		}
	}
	findArchetype(archetypeUsed){
		let archetypeAvailable = archetypeDispo();

		let archetypeKept = [];
		let participantsData = window.database.participants;
		for(let participantId in participantsData){
			let data = participantsData[participantId];

			if(archetypeAvailable.indexOf(participantId) === -1)
				continue;

			if(this.hairColor !== undefined && this.hairColor != data.hairColor)
				continue;

			if(archetypeUsed.length > 0 && archetypeUsed.indexOf(participantId) !== -1)
				continue;

			archetypeKept.push(participantId);
		}
		this.archetype = pickRandom(archetypeKept);
	}
	findName(namesUsed){
		this.lastname = pickRandom(clone(window.database.characterInfo.lastNames));
		
		let iteration = 0;
		while(this.firstname === undefined && iteration < 100){
			if(this.gender == 'man'){
				this.firstname = pickRandom(clone(window.database.characterInfo.maleNames));
			}else{
				this.firstname = pickRandom(clone(window.database.characterInfo.femaleNames));
			}

			//Avoid duplicate
			if(namesUsed.indexOf(this.firstname+' '+this.lastname) != -1)
				delete this.firstname;
			iteration++;
		}
		if(iteration >= 100)
			console.log('Error: Name Overflow');
	}
	findProfile(){				//Define Housemates
		let existingElements = this.getExistingElements();

		//Name
			this.findName(existingElements.namesUsed);

		//Archetype
			if(this.archetype === undefined)
				this.findArchetype(existingElements.archetypeUsed);
	}
	setUpBody(){				//Set Hair Color, Type Body, Hypno Portrait & Outside Perks
		//Hair Color
		if(this.hairColor === undefined)
			this.hairColor = window.database.participants[this.archetype].hairColor;

		//Type Body
		this.typeBody = window.database.participants[this.archetype].typeBody;

		//HypnoFace
		if(window.database.participants[this.archetype].hypnoPortrait !== undefined){
			this.hypnoFaceSet = pickRandom(Object.keys(window.database.participants[this.archetype].hypnoPortrait));
		}

		//Add Perk
		if(this.id == 'player' && this.starting !== undefined && this.starting.archetype != this.archetype){
			for(let perk of window.database.participants[this.archetype].perks){
				this.addPerks(perk);
			}
		}

		//Set Profile Face
		if(window.database.participants[this.archetype].profilePicts !== undefined && Object.keys(window.database.participants[this.archetype].profilePicts).length > 0){
		 	this.profilePictsSet = pickRandom(Object.keys(window.database.participants[this.archetype].profilePicts));
		}

		//Set up age
		this.age = random(window.database.participants[this.archetype].ageRange[0],window.database.participants[this.archetype].ageRange[1]);
		if(this.starting !== undefined && this.starting.age === undefined)
			this.starting.age = this.age;
		this.giveBirthday();
	}
	fillInfo(){
		this.city = pickRandom(window.database.characterInfo.cities);
		this.passionsTransformed = [];
		this.previousProfile = [];

		if(this.behavior !== undefined){
			let behaviorData = window.database.behaviors[this.behavior];
			this.job = pickRandom(behaviorData.jobs);
			this.iq = random(behaviorData.iq[0],behaviorData.iq[1]);
			let nbPassion = random(3,behaviorData.passion.length-1);
			this.passions = pickRandom(behaviorData.passion,nbPassion);

			this.sexualpref = pickRandomPond(behaviorData.sexualPrefStart);
			this.startStats = {
				'iq':this.iq,
				'passions':this.passions,
				'sexualpref':this.sexualpref,
			};

			//Generate Testimonial
			this.generateTestimonial();

			this.save();
		}else{
			this.iq = random(90,150);
			this.job = 'unknown';
			this.passions = ['unknown'];

			this.sexualpref = 'heterosexual';
		}
	}
	giveBirthday(){				//Give a birthday and the Astrological sign
		//Get a Birthday
			let date = new Date();
			let yearOfBirth = date.getUTCFullYear() - this.age;
			let startOfTheYear = new Date(yearOfBirth+'-01-01');
			let pickRandomDate = random(1,364);
			let birthDay = startOfTheYear.getTime() + (pickRandomDate * 24 * 60 * 60 * 1000);
			let birthDayDate = new Date(birthDay);
			this.birthday = giveTimeString(birthDay,'format');

		//Get the Sign
			let allSign = window.database.characterInfo.astrologicalSign;
			for(let sign in allSign){
				let dateIn = new Date(yearOfBirth+'-'+allSign[sign][0]);
				let dateOut = new Date(yearOfBirth+'-'+allSign[sign][1]);
				if(
					(dateIn < dateOut && birthDayDate >= dateIn && birthDayDate <= dateOut)||
					(dateIn > dateOut && (birthDayDate >= dateIn || birthDayDate <= dateOut))
				){
					this.astrologicSign = sign;
					break;
				}
			}
	}
	finishSetUp(){				//Finish to set up the char
		//Define the suposed behavior
		let characters = Object.keys(getStorage('characters'));
		let behaviorsUsed = [];
		for(let charId of characters){
			let char = getCharacter(charId);
			if(char.get('behavior') !== undefined){
				behaviorsUsed.push(char.get('behavior'));
			}
		}
		let behaviorsList = Object.keys(window.database.behaviors);
		behaviorsList.splice(behaviorsList.indexOf('default'),1);
		let unused = arrayDiff(behaviorsList,behaviorsUsed);
		this.behavior = pickRandom(unused);
		this.fillInfo();
		this.saveProfile();
		this.save();
	}
	addPerks(ids){				//Add more perks to the character
		let changeProfile = false;
		let perksInfo = window.database.perks;
		for(let id of ids){
			if(id[0] == '-'){	//Remove the perk
				id = id.slice(1);
				let ind = this.perks.indexOf(id);
				if(ind !== -1){
					this.perks.splice(ind,1);
				}
			}else if(!this.havePerk(id)){	//Add the perk if not already there
				this.perks.push(id);

				//Change sexual pref if too much vanilla
				if(perksInfo[id].sexualPref !== undefined && ['heterosexual','heterocurious','homosexual'].indexOf(this.sexualpref) !== -1){
					this.sexualpref = perksInfo[id].sexualPref;
					changeProfile = true;
				}

				//Add Passions
				if(perksInfo[id].passions !== undefined){
					let passionsTransition = window.database.passionsTransition;
					for(let passionId of perksInfo[id].passions){
						if(passionsTransition[passionId] !== undefined){
							if(this.passions.indexOf(passionId) === -1){
								this.passions.push(passionId);
								changeProfile = true;
							}
						}else{
							if(this.passionsTransformed.indexOf(passionId) === -1){
								this.passionsTransformed.push(passionId);
								changeProfile = true;
							}
						}
					}
				}
			}
		}

		if(changeProfile)
			this.saveProfile();

		this.save();
	}
	havePerk(id){				//Tell if the character have this perk
		return this.perks.indexOf(id) !== -1;
	}
	addvotes(type,id){			//Give the votes for the character according to the type
		let newVote = 0;
		if(type == 'cameraroom'){
			newVote = window.database.difficulty[getStorage('difficulty')].votePerCamera;
			this.cameraUsed = true;
			if(this.havePerk('hairperfectionist'))
				newVote *= 1.1;

		}else if(type == 'discuss'){
			newVote = window.database.difficulty[getStorage('difficulty')].votePerDiscuss;
			if(this.havePerk('makeupmaster')){
				let makeup = this.doHave('makeup');
				if(makeup !== false){
					newVote *= 1 + (makeup.stage * 0.1);
				}
			}
		}else if(type == 'action'){
			newVote = window.database.difficulty[getStorage('difficulty')].votePerAction;
			if(this.havePerk('voluptuous'))
				newVote *= 1.1;
		}else if(type == 'funtime'){
			newVote = window.database.difficulty[getStorage('difficulty')].votePerFuntime;
			let sextoys = this.doHave('sextoys');
			if(sextoys !== false){
				newVote *= sextoys.stage;
			}
		}else if(type == 'bonusStage'){
			let participants = getHousemateId('all');
			for(let participantId of participants){
				let participant = getCharacter(participantId);
				newVote += participant.get('stage') * window.database.difficulty[getStorage('difficulty')].votePerStageBonus;
			}
		}

		//Malus on repetitive activities
		let occuActivity = 0;
		if(['funtime','cameraroom','bonusStage'].indexOf(type) === -1){
			let key = type+'-'+id;
			if(this.histoActivities === undefined)
				this.histoActivities = [];
			let nbHisto = window.database.difficulty[getStorage('difficulty')].histoActivities;
			let occArr = arrayOccurence(this.histoActivities);
			if(occArr[key] !== undefined){
				newVote -= Math.min(newVote,occArr[key]*0.33 * newVote);
				occuActivity = occArr[key];
			}
			if(this.histoActivities.length == nbHisto)
				this.histoActivities.shift();
			this.histoActivities.push(key);
		}

		let influence = 1;

		//State
		influence += this.slut/2 * 0.005;
		influence += this.bimbo/2 * 0.001;

		//Boobs Size 5% per size after small
		influence += Math.floor(0.05 * window.database.boobsSize.indexOf(this.sizeBoobs) * 100) / 100;

		//Bottom 5% per size after basic
		influence += Math.floor(0.05 * window.database.bottomType.indexOf(this.bottomType) * 100) / 100;

		//Perks
		for(let perkId of this.get('perks')){
			let perkInfo = window.database.perks[perkId];
			if(perkInfo.votesMult !== undefined)
				influence *= perkInfo.votesMult;
			if(perkInfo.votes !== undefined)
				influence += perkInfo.votes;
		}

		let newVoteInfluenced = Math.floor(newVote * influence);
		//console.log("vote: "+newVote,'influence: '+(Math.round(influence * 100)/100),'influenced: '+newVoteInfluenced);

		this.stats.totalVoteGain += newVoteInfluenced;

		this.votes += newVoteInfluenced;
		this.save();

		//Effect to display the popup
		let newVoteDisplay = Math.round(newVoteInfluenced);
		if(setting('showpoints') && (newVoteDisplay > 0||occuActivity > 0)){
			let classNerf = '';
			let textVote = getTrad('basic.votegain',{'nbvote':newVoteDisplay});
			if(occuActivity > 0)
				classNerf = 'voteWarning';
			if(newVoteDisplay <= 0){
				classNerf = 'voteDanger';
				textVote = getTrad('basic.novotegain');
			}
			let newVotesDiv = document.createElement('div');
			newVotesDiv.innerHTML = '<span class="icon icon-heart"></span><span id="popupVotesContent" class="'+classNerf+'">'+textVote+'</span><span class="icon icon-heart"></span>';
			getId('popupVotes').appendChild(newVotesDiv);
			addClass(newVotesDiv,'open');
			setTimeout(function() {removeClass(newVotesDiv,'open');}, 100);
			setTimeout(function() {addClass(newVotesDiv,'close');}, 3000);
			setTimeout(function() {getId('popupVotes').removeChild(newVotesDiv);}, 6000);
		}

		return {'nbVote':newVoteDisplay,'occuActivity':occuActivity};
	}
	beHypno(type,strength){		//Play the stats change when hypno with the type for the specified strength
		let pts = 0;
		let increase = window.database.difficulty[getStorage('difficulty')].hypno.increase;
		let baseHypno = window.database.difficulty[getStorage('difficulty')].hypno.baseHypno;
		switch(strength){
			case 1:pts=baseHypno*increase[0];break;
			case 2:pts=baseHypno*increase[1];break;
			case 3:pts=baseHypno*increase[2];break;
			case 4:pts=baseHypno*increase[3];break;
		}
		pts = Math.ceil(pts);
		if(type == 'mix'){
			pts *= 0.5;
			this.add('bimbo',pts);
			this.add('slut',pts);
		}else{
			this.add(type,pts);
		}
		if(strength >= 4){
			let hypnoTypes = window.database.hypnoTypes;
			this.add([hypnoTypes[type].crave],1);
		}
		console.log('Hypno',type,strength,pts);
	}
	updateMorning(){			//Give a set to use to display the player in the hallway
		let inHallwayData = window.database.participants[this.archetype].inHallway;
		if(inHallwayData !== undefined){
			this.pickHallwaySet = pickRandom(Object.keys(inHallwayData));
			this.save();
		}
	}
	getLastFace(){				//Give the last face
		let tmpFace = Object.keys(window.database.participants[this.archetype].picts);
		return window.database.participants[this.archetype].picts[tmpFace[tmpFace.length-1]];
	}
	changeFace(forceModel = null){				//Being Transformed / Morphed
		let listDispo = archetypeDispo('available');
		if(this.oldArchetype !== undefined)	//Don't have the previous one
			listDispo.splice(listDispo.indexOf(this.oldArchetype),1);

		if(forceModel !== null)
			listDispo.push(forceModel);

		if(listDispo.length > 0){
			let newArchetype = pickRandom(listDispo);
			if(forceModel !== null)
				newArchetype = forceModel;

			if(newArchetype != this.archetype){
				this.oldArchetype = this.archetype;

				this.archetype = newArchetype;
				let infoArchetype = window.database.participants[this.archetype];

				//Save the boobs
				this.oldBoobsSize = this.sizeBoobs;
				this.oldBoobsSet = this.topCloth;
				this.sizeBoobs = infoArchetype.sizeBoobs;

				//If Boobs Bought keep the increase
				if(this.inventory.boobsenlargement !== undefined){
					for(let i = 0; i < parseInt(this.inventory.boobsenlargement.stage); i++){
						let indexboobs = window.database.boobsSize.indexOf(this.sizeBoobs);
						this.sizeBoobs = window.database.boobsSize[indexboobs+1];
					}
				}

				//Save the oldface & change to the new one
				this.oldface = this.pict;
				if(this.id == 'player'){
					this.giveFace();
				}else{
					let archetypePicts = window.database.participants[this.archetype].picts;
					this.pict = archetypePicts[this.pictList[ this.stage ]];
				}

				//Other
				this.typeBody = infoArchetype.typeBody;
				this.hairColor = infoArchetype.hairColor;
				this.faceless = pickRandom(window.database.fleshrealmData.facelessPlayer[this.hairColor]);
				this.age = random(infoArchetype.ageRange[0],infoArchetype.ageRange[1]);
				let date = new Date();
				let yearOfBirth = date.getUTCFullYear() - this.age;
				let tmpBirthday = this.birthday.split('/');
				tmpBirthday[2] = yearOfBirth;
				this.birthday = tmpBirthday.join('/');

				//Select the camsPhoto set
				let camsPhotoSets = Object.keys(infoArchetype.camsPhoto);
				this.camsPhotoId = pickRandom(camsPhotoSets);

				//Pick a set of cloth
				let topSets = getClothes('topCloth',this.sizeBoobs);
				if(this.oldBoobsSize == this.sizeBoobs && topSets.length > 1)
					topSets.splice(topSets.indexOf(this.oldBoobsSet),1);
				this.topCloth = pickRandom(topSets);

				//Change Activities set
				this.activities = this.chooseActivitiesSet();

				this.save();
				
				//Perks
				for(let perk of window.database.participants[this.oldArchetype].perks)
					this.addPerks(['-'+perk]);
				this.addPerks(infoArchetype.perks);

				if(this.id == 'player'){
					let archeHisto = this.get('stats.archetypeUsed');
					if(archeHisto[newArchetype] === undefined)
						archeHisto[newArchetype] = 0;
					archeHisto[newArchetype]++;
					this.set('stats.archetypeUsed',archeHisto);
				}

				//Hallway picts
				this.updateMorning();

				//Regen The Char Details
				this.saveProfile(-1);
			}
		}
	}
	changeCloth(type,action,amount = 1){	//Change a set of cloth or type
		let kindDispo = [];
		let kind = null;
		if(type == 'topCloth'){
			kindDispo = clone(window.database.boobsSize);
			kindDispo.splice(kindDispo.indexOf('titanic'),1);	//At least now
			kind = 'sizeBoobs';
			this.oldBoobsSize = this[kind];
			this.oldBoobsSet = this[type];
		}else{
			kindDispo = window.database.bottomType;
			kind = 'bottomType';
			this.oldButtType = this[kind];
			this.oldButtSet = this[type];
		}

		if(action == 'increase'){					//Take the next stage of cloth and choose a set
			let find = kindDispo.indexOf(this[kind]);
			if(kindDispo[find+amount] !== undefined)
				this[kind] = kindDispo[find+amount];
			else
				this[kind] = kindDispo[kindDispo.length-1];
		}else if(action == 'decrease'){				//Take the previous stage of cloth and choose a set
			let find = kindDispo.indexOf(this[kind]);
			if(kindDispo[find-amount-1] !== undefined)
				this[kind] = kindDispo[find-amount-1];
			else
				this[kind] = kindDispo[0];
		}else if(action == 'random'){				//Take a random stage of cloth and choose a set
			//Try not to overshot, if no enlargement as been bought
			if(type == 'topCloth'){
				let stageCurrent = (this.inventory.boobsenlargement !== undefined ? this.inventory.boobsenlargement.stage : 0);
				let maxSize = kindDispo.length - 3 + stageCurrent;
				kindDispo = kindDispo.slice(0,maxSize);
			}
			this[kind] = pickRandom(kindDispo);
		}

		let setOfCloth = getClothes(type,this[kind]);

		//Not having the same
		let testHere = setOfCloth.indexOf(this[type]);
		if(testHere !== -1 && setOfCloth.length > 1){
			setOfCloth.splice(testHere,1);
		}

		this[type] = pickRandom(setOfCloth);

		this.save();
	}
	add(id,val){				//Add modify stats

		let valOrigin = val;
		let influence = 1;

		//Perk Influence
			for(let perkId of this.perks){
				let perkInfo = window.database.perks[perkId];
				if(perkInfo.influence !== undefined){
					if(id == 'slut' && perkInfo.influence.slut !== undefined)
						influence += perkInfo.influence.slut;
					if(id == 'bimbo' && perkInfo.influence.bimbo !== undefined)
						influence += perkInfo.influence.bimbo;
				}
			}

		//Clothes
			//Boobs Size 5% per size after small
			influence += Math.floor(0.05 * window.database.boobsSize.indexOf(this.sizeBoobs) * 100) / 100;

			//Bottom 5% per size after basic
			influence += Math.floor(0.05 * window.database.bottomType.indexOf(this.bottomType) * 100) / 100;

		//Stage Influence 20% per stage
			if(['bimbo','slut'].indexOf(id) != -1)
				influence += ((parseInt(this[id+'Stage'])-1)/20);

		influence = Math.round(influence * 100) / 100;
		val *= influence;
		//console.log('type:'+id,'val origin:'+valOrigin,'val final:'+val,'influence:'+influence);
		let newVal = (Math.round((this[id] + val)*100)/100);

		if(['bimbo','slut'].indexOf(id) !== -1 && newVal > 100){
			newVal = 100;
		}else if(['bimbo','slut'].indexOf(id) !== -1 && newVal < 0){
			newVal = 0;
		}

		this.set(id,newVal);
	}
	set(id,val){
		if(id.indexOf('.') !== -1){
			let objVal = gObj(this,id);
			if(val == '++')
				val = objVal+1;
			else if(val == '--')
				val = objVal-1;
			sObj(this,id,val);
		}else{
			if(val == '++')
				val = this[id]+1;
			else if(val == '--')
				val = this[id]-1;
			this[id] = val;
		}
		if(['bimbo','slut'].indexOf(id) !== -1){
			this.giveState('slut');
			this.giveState('bimbo');
			this.definePseudo();
			this.giveFace();
		}
		this.save();
	}
	get(varId){

		if(varId == 'slutState'){
			if(this.havePerk('exhibitionist')||this.havePerk('naturist')){
				let slutRanges = Object.keys(window.database.slutRanges);
				return slutRanges[slutRanges.length-1];
			}
		}

		return gObj(this,varId);
	}
	save(){
		setCharacter(this.id,JSON.stringify(this));
	}
}

/******************************/
/********* HELPER *************/
/******************************/

//Clone variable
function clone(obj) {
	let copy;

	// Handle the 3 simple types, and null or undefined
	if (null == obj || "object" != typeof obj) return obj;

	// Handle Date
	if (obj instanceof Date) {
		copy = new Date();
		copy.setTime(obj.getTime());
		return copy;
	}

	// Handle Array
	if (obj instanceof Array) {
		copy = [];
		for (let i = 0, len = obj.length; i < len; i++) {
			copy[i] = clone(obj[i]);
		}
		return copy;
	}

	// Handle Object
	if (obj instanceof Object) {
		copy = {};
		for (let attr in obj) {
			if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
		}
		return copy;
	}

	throw new Error("Unable to copy obj! Its type isn't supported.");
}
//Give the position of a class
function findClass(element,className){
	let classes = element.className;
	if(classes === undefined)
		return -1;
	classes = classes.split(' ');
	return classes.indexOf(className);
}
function haveClass(element,className){return (findClass(element,className) != -1);}
//Add a class to the element
function addClass(element,className,position){
	if(element !== null){
		if(position === undefined)
			position = findClass(element,className);
		if(position == -1)
			element.classList.add(className);
	}
}
//Remove a class to the element
function removeClass(element,className,position){
	if(element !== null){
		if(position === undefined)
			position = findClass(element,className);
		if(position != -1){
			element.classList.remove(className);
		}
	}
}
function emptyClass(element,list){
	if(list === undefined)
		element.className = '';
	else{
		for(let id of list){
			removeClass(element,id);
		}
	}
}
//Toggle a class to the element
function toggleClass(element,className){
	let position = findClass(element,className);
	if(position == -1)
		addClass(element,className,position);
	else
		removeClass(element,className,position);
}
function getId(id,from){
	if(from !== undefined)
		return getId(from).getElementById(id);
	else
		return document.getElementById(id);
}
function showError(error){
	let trace = error.stack.split("\n");
	let traceClear = [];
	for(let line of trace){
		let tmp = line.split('/');
		traceClear.push(tmp[0]+'...'+tmp[tmp.length-1]);
	}
	traceClear = traceClear.join('<br>');
	getId('errorContent').innerHTML = error.name + "<br><b>" + error.message + "</b><br>" + traceClear;
	removeClass(getId('popupError'),'hide');
	addClass(getId('popupError'),'show');
	getId('closeError').onclick = function(){
		getId('errorContent').innerHTML = '';
		addClass(getId('popupError'),'hide');
		removeClass(getId('popupError'),'show');
	};
}
function getLocalStorageIntake(){
	let info = [];
	let _lsTotal=0,_xLen,_x;for(_x in localStorage){ if(!localStorage.hasOwnProperty(_x)){continue;} _xLen= ((localStorage[_x].length + _x.length)* 2);_lsTotal+=_xLen; info.push(_x.substr(0,50)+" = "+ (_xLen/1024).toFixed(2)+" KB")};info.push("Total = " + (_lsTotal / 1024).toFixed(2) + " KB");
	return info;
}

//Storage
	//Create or Set the Storage
	function setStorage(name,value){
		if(name !== null && value !== undefined){
			if (value instanceof Array)
				value = JSON.stringify(value);
			else if (value instanceof Object)
				value = JSON.stringify(value);
			window.localStorage.setItem(storagePrefix+profileId+'_'+name,value);
		}
	}
	//Get Storage Info
	function getStorage(name,defaultVal){
		let getValue = window.localStorage.getItem(storagePrefix+profileId+'_'+name);
		if(!getValue){
			if(defaultVal !== undefined)
				return defaultVal;
			else
				return false;
		}
		//If it's a json parse the data or give directely the data
		try {
			return JSON.parse(getValue);
		} catch (e) {
			return getValue;
		}
	}
	//Delete Storage
	function deleteStorage(name){window.localStorage.removeItem(storagePrefix+profileId+'_'+name);}
	//Erase Everything
	function clearStorage(){
		for(let key in window.localStorage){
			if(key.indexOf(storagePrefix) === 0){
				window.localStorage.removeItem(key);
			}
		}
		//window.localStorage = {};
		//window.localStorage.clear();
	}
	//Reset the Storage of a profile
	function cleanStorage(type){
		let notThat = ['settings','saves','currentPage','backPage'];
		if(type == 'all')
			notThat = ['saves'];
		let prefix = storagePrefix+profileId+'_';
		for(let tmpid in notThat){
			notThat[tmpid] = prefix+notThat[tmpid];
		}
		for(let elemId in window.localStorage){
			if(notThat.indexOf(elemId) == -1 && elemId.indexOf(prefix) != -1){
				deleteStorage(elemId.replace(prefix,''));
			}
		}
	}

function addLogs(type, id, text){
	let logs = getStorage(type);
	if(logs == false)
		logs = {};

	if(logs[id] === undefined)
		logs[id] = [];
	logs[id].push(text);

	setStorage(type,logs);
}
function getLogs(type){
	return getStorage(type);
}
function getCharacter(char){
	let chars = getStorage('characters');
	if(chars !== false && chars[char] !== undefined && chars[char] !== false)
		return Object.assign(new Character(), JSON.parse(chars[char]));
	else
		return false;
}
function getRoomPicture(location){								//Give the room picture
	let villa = getStorage('villa');
	let pict = '';
	if(location.indexOf('bedroom.') !== -1){
		let tmp = location.split('.');
		pict = villa.bedrooms[tmp[1]].pict;
	}else if(location == 'bedrooms'){
		pict = villa.hallway;
	}else if(villa[location] !== undefined && typeof villa[location] == 'string'){
		pict = villa[location];
	}else{
		pict = villa.locations[location].pict;
	}

	if(location == 'garden' && villa.pool !== undefined){
		pict = villa.pool;
	}
	return pict;
}
function setCharacter(char,info){
	let chars = getStorage('characters');
	if(chars == false)
		chars = {};
	chars[char] = info;
	setStorage('characters',chars);
}
function getLocationInfo(loca){
	let villaData = getStorage('villa');
	if(loca == 'bedrooms'){
		infoLocation = {'type':'bedrooms'};
	}else if(loca.indexOf('bedroom') !== -1){
		let tmp = loca.split('.');
		infoLocation = villaData.bedrooms[tmp[1]];
	}else if(loca == 'hallway'){
		infoLocation = {'type':'hallway'};
	}else{
		infoLocation = villaData.locations[loca];
	}

	if(infoLocation !== undefined)
		infoLocation.people = retrivePeopleAround(loca);

	return infoLocation;
}
function getHousemateId(type){
	let charactersId = Object.keys(getStorage('characters'));

	if(type === undefined||type != 'everyone')
		charactersId.splice(charactersId.indexOf('player'),1);

	//See if we need to get ride of defeated housemate
	if(type === undefined||type !== 'all'){
		let settingInfo = setting('defeatedhousemate');
		if(
			settingInfo == 'out'||
			type == 'notout'||
			(type == 'actif' && ['out','passive'].indexOf(settingInfo) !== -1)
		){
			let outList = [];
			for(let participantId of charactersId){
				let participant = getCharacter(participantId);
				if(participant.get('out')){
					outList.push(participantId);
				}
			}
			charactersId = arrayDiff(charactersId,outList);
		}
	}

	return charactersId;
}
function getClothes(type,value,defaultVal = false){
	let keys = [];
	for(let setId in window.database.cloth[type][value]){
		keys.push(value+'_'+setId);
	}
	if(defaultVal){
		return keys
	}else{
		let save = clone(keys);
		let settingInfo = undefined;
		if(type == 'topCloth')
			settingInfo = setting('clothtopChoose');
		else
			settingInfo = setting('clothbottomChoose');

		for(let key in settingInfo){
			let find = keys.indexOf(key);
			let valSet = settingInfo[key];

			if(find != -1 && valSet == ''){
				keys.splice(find,1);
			}else if(find == -1 && valSet == value){
				keys.push(key);
			}else if(find != -1 && valSet != value){
				keys.splice(find,1);
			}
		}

		//Avoid No Result
		if(keys.length == 0)
			keys = save;
	}
	return keys;
}
function getDayTimeList(){
	let list = clone(window.database.dayTime);
	if(getStorage('difficulty') !== 'nightmare')
		delete list.noon;
	return list;
}
function increaseTime(){
	let timeDay = getStorage('timeDay');

	let dayTime = Object.keys(getDayTimeList());
	let index = dayTime.indexOf(timeDay);

	setStorage('timeDayPrevious',timeDay);
	if(dayTime[index+1] === undefined){
		setStorage('timeDay',dayTime[0]);	//Morning
		setStorage('dayNumber',parseInt(getStorage('dayNumber')) + 1);
		setStorage('currentLocation','bedroom.player');
		setStorage('playNextDay',true);
		let player = getCharacter('player');
		player.updateMorning();
	}else{
		setStorage('timeDay',dayTime[index+1]);
	}
}
function giveTimeString(date,type){
	let dateall = new Date(date);
	let dayname = dateall.getUTCDay();
	let days = getTrad('basic.dayname');
	days = Object.values(days);
	let months = getTrad('basic.month');
	months = Object.values(months);

	let text = '';
	if(type === undefined)
		text = ucfirst(days[dateall.getDay()])+', '+dateall.getDate()+' '+ucfirst(months[dateall.getMonth()])+' '+dateall.getFullYear()+'<br>⏲ '+('0' + dateall.getHours()).slice(-2)+':'+('0' + dateall.getMinutes()).slice(-2);
	else if(type === 'dayId')
		text = dateall.getDay();
	else if(type === 'dayname')
		text = ucfirst(days[dateall.getDay()]);
	else if(type === 'month')
		text = ucfirst(months[dateall.getMonth()])
	else if(type === 'monthId')
		text = dateall.getMonth()+1;
	else if(type === 'number')
		text = dateall.getDate();
	else if(type === 'hour')
		text = ('0' + dateall.getHours()).slice(-2);
	else if(type === 'min')
		text = ('0' + dateall.getMinutes()).slice(-2);
	else if(type === 'format')
		text = ('0' + dateall.getDate()).slice(-2)+'/'+('0' + (dateall.getMonth()+1)).slice(-2)+'/'+dateall.getFullYear();
	else if(type === 'formatReverse')
		text = dateall.getFullYear()+'-'+('0' + (dateall.getMonth()+1)).slice(-2)+'-'+('0' + dateall.getDate()).slice(-2);
	else if(type === 'formatFull')
		text = dateall.getFullYear()+'-'+('0' + (dateall.getMonth()+1)).slice(-2)+'-'+('0' + dateall.getDate()).slice(-2)+' '+('0' + dateall.getHours()).slice(-2)+':'+('0' + dateall.getMinutes()).slice(-2)+':00';
	else if(type === 'time')
		text = ('0' + dateall.getHours()).slice(-2)+':'+('0' + dateall.getMinutes()).slice(-2);

	return text;
}
function givePartToUsed(choices,character,type){
	let nbStage = window.database.difficulty[getStorage('difficulty')].nbStage;
	let nbChoice = Object.keys(choices).length;
	let typeChoice = null;

	let stateIndex = null;
	if(character.get('id') == 'player'){
		if(['testimonial','album'].indexOf(type) != -1){
			nbStage = Object.keys(window.database.stagePlayerThreshold).length + 1;
			stateIndex = Math.floor((character.bimboStage + character.slutStage)/2);
		}else{
			stateIndex = (Math.round(character.giveExitation()/(100/nbStage)) - 1);
		}
	}else{
		stateIndex = character.get('stage');
	}

	if(nbChoice == nbStage && stateIndex < Object.keys(choices).length){
		typeChoice = Object.keys(choices)[stateIndex];
	}else{
		typeChoice = Object.keys(choices)[Math.floor((nbChoice-1)/nbStage * stateIndex)];
	}

	return typeChoice;
}
function giveDiscussText(elem,text,housemate){

	let classText = 'centerContent';
	if(elem.class !== undefined)
		classText = elem.class;

	let player = getCharacter('player');
	if(elem.who !== undefined && elem.who !== null){
		let pict;let name;
		if(elem.who == 'player'){
			pict = player.get('pict');
			if(elem.pictType == 'hypnoPicts')
				pict = pickRandom(clone(window.database.participants[player.get('archetype')].hypnoPicts));
			else if(elem.pictType == 'oldface')
				pict = player.get('oldface');
			else if(elem.pictType == 'startface')
				pict = player.starting.face;
			else if(elem.pictType == 'last')
				pict = player.getLastFace();
			else if(elem.pictType == 'faceless')
				pict = player.faceless;
			name = player.getName();
		}else if(elem.who == 'housemate'){
			pict = housemate.get('pict');
			if(elem.pictType == 'hypnoPicts' && housemate.giveHypnoFace() !== '')
				pict = housemate.giveHypnoFace();
			name = housemate.getName();
		}else if(elem.who == 'ia'){
			pict = pickRandom(clone(window.database.ia.speaking));
			if(elem.pictType !== undefined && elem.pictType !== 'speaking')
				pict = pickRandom(clone(window.database.ia[elem.pictType]));
			name = window.database.ia.iaName;
		}else if(elem.who == 'scientist'){
			let typeFace = 'face';
			if(elem.pictType !== undefined)
				typeFace = elem.pictType;
			pict = window.database.events[elem.event].picts[getStorage('villa').scientistSet][typeFace];
			name = getTrad('events.scientist.name');
		}else if(elem.who == 'accountant'){
			let typeFace = 'face';
			if(elem.pictType !== undefined)
				typeFace = elem.pictType;
			pict = window.database.events[elem.event].picts[getStorage('villa').accountantSet][typeFace];
			name = getTrad('events.accountant.name');
		}else if(elem.who == 'fleshgoddess'){
			pict = pickRandom(clone(window.database.fleshrealmData.goddessSet[getStorage('villa').fleshgoddessSet].face));
			if(elem.name !== undefined){
				name = getTrad('fleshrealm.goddess.'+elem.name);
			}else{
				name = getTrad('fleshrealm.goddess.name');
			}
		}else if(elem.who == 'naturegoddess'){
			pict = pickRandom(clone(window.database.naturerealmData.goddessSet[getStorage('villa').naturegoddessSet].face));
			if(elem.name !== undefined){
				name = getTrad('naturerealm.goddess.'+elem.name);
			}else{
				name = getTrad('naturerealm.goddess.name');
			}
		}else if(elem.who == 'other'){
			pict = pickRandom(elem.pics);
			name = getTrad(elem.name);
		}
		return discuss(pict,name,text);
	}else if(elem.raw !== undefined){
		return elem.raw;
	}else if(elem.media !== undefined){
		if(typeof text === 'object')
			text = pickRandom(text);
		return '<div class="'+classText+'">'+imgVideo(text)+'</div>';
	}else if(elem.hypno !== undefined){
		let hypnoChoosed = null;
		if(elem.hypno !== 'random')
			hypnoChoosed = elem.hypno;
		else
			hypnoChoosed = pickRandom(Object.keys(window.database.hypnoTypes));
		let vid = pickRandom(window.database.hypnoTypes[hypnoChoosed].vids);

		let hypnoPict = '';
		if(elem.pictType !== undefined && elem.pictType == 'oldface')
			hypnoPict = pickRandom(clone(window.database.participants[player.get('oldArchetype')].hypnoPicts));
		else
			hypnoPict = pickRandom(clone(window.database.participants[player.get('archetype')].hypnoPicts));

		let hypnoText = getTrad('hypnoTypes.'+hypnoChoosed+'.continue');
		let contentDisplay = [];
		contentDisplay.push('<div class="'+classText+'">'+imgVideo(vid)+'</div>');
		contentDisplay.push(discuss(hypnoPict,majText(getTrad('basic.you')),hypnoText));
		return contentDisplay.join('');
	}else{
		return '<div class="'+classText+'">'+text+'</div>';
	}
}

//To fix the issu with F5 which keep play again stats
function saveStateGame(){
	let elemsSaved = {};
	for(let elem of elemsToSave){
		elemsSaved[elem] = getStorage(elem);
	}
	setStorage('stateGame',JSON.stringify(elemsSaved));
}
function loadStateGame(){
	let save = getStorage('stateGame');
	if(save !== false){
		for(let elem of elemsToSave){
			if(save[elem] === undefined||save[elem] === false){
				deleteStorage(elem);
			}else{
				setStorage(elem,save[elem]);
			}
		}
	}
}

//Put a Majuscule on every word
function ucfirst(text){
	let elems = text.split(' ');
	for(let i in elems){
		elems[i] = elems[i].charAt(0).toUpperCase() + elems[i].slice(1);
	}
	return elems.join(' ');
}
//Put a Maj on the first word
function majText(text){
  return text.charAt(0).toUpperCase() + text.slice(1);
}

//Array Utils
	function arrayUnique(arr){return [...new Set(arr)]};
	function arrayDiff(arr1,arr2){ return arr1.filter(x => !arr2.includes(x)); }
	function arrayInter(arr1,arr2){ return arr1.filter(x => arr2.includes(x)); }
	function arrayConcat(arr1,arr2){ return arr1.concat(arr2); }
	function arrayOccurence(arr,sort){
		let counts = {};
		for (let el of arr) {
			counts[el] = counts[el] ? counts[el] + 1 : 1;
		}
		if(sort !== undefined){
			counts = arrayAssocSort(counts);
		}
		return counts;
	}
	function arrayShuffle(array){
	  let random = null;
	  let index = array.length;
	  while (index != 0) {
		random = Math.floor(Math.random() * index);
		index--;
		[ array[index], array[random] ] = [ array[random], array[index] ];
	  }
	  return array;
	}
	function arrayFlip(array){
		return Object.entries(array).reduce((obj, [key, value]) => ({ ...obj, [value]: key }), {});
	}
	function arrayFlipNumber(array){
		return Object.entries(array).reduce((obj, [key, value]) => ({ ...obj, [value]: parseInt(key) }), {});
	}
	function arrayAssocSort(arr,asc=true){
		if(asc)
			return Object.entries(arr).sort((a,b)=>a[1]-b[1]).map(el=>el[0]);
		else
			return Object.entries(arr).sort((a,b)=>b[1]-a[1]).map(el=>el[0]);
	}
	function arrayAssocSortFull(arr,asc=true){
		let arrReturn = {};
		let keysAct = Object.keys(arr);
		keysAct.sort(function(a, b){
			return arr[a].localeCompare(arr[b]);
		});
		if(!asc)
			keysAct = keysAct.reverse();
		for(k of keysAct){
			arrReturn[k] = arr[k];
		}
		return arrReturn;
	}
	function pickRandom(arr,nb){
		if(arr !== undefined){
			if(nb === undefined){
				let idRandom = random(0,arr.length-1);
				return arr[idRandom];
			}else{
				arr = clone(arr);
				let results = [];
				for(let i=0;i < nb; i++){
					if(arr.length > 0){
						let idRandom = random(0,arr.length-1);
						results.push(arr[idRandom]);
						arr.splice(idRandom,1);
					}
				}
				return results;
			}
		}
		return false;
	}
	function random(min,max,float){
		if(min instanceof Array && min.length == 2)
			return random(min[0],min[1],max);

		if(float === undefined||!float)
			return Math.round(Math.random() * (parseInt(max)-parseInt(min)))+parseInt(min);
		else
			return Math.round(Math.random() * (parseInt(max)-parseInt(min)) * 100)/100+parseInt(min);
	}
	function randomStep(min,max,step){
		let arr = [];
		for(let i=min;i<=max;i+=step){
			arr.push(i);
		}
		return pickRandom(arr);
	}
	function pickRandomPond(arr,nb){
		if(nb === undefined)
			cycle = 1;
		else
			cycle = nb;

		let pondarr = [];
		for(let elemId in arr){
			for(let i=0;i<arr[elemId];i++){
				pondarr.push(elemId);
			}
		}

		let results = [];
		for(let i=0;i<cycle;i++){
			results.push(pickRandom(pondarr));
		}

		if(nb===undefined)
			return results[0];
		else
			return results;
	}

function normalize(val,min,max){
	if(min === undefined)
		min = 0;
	if(max === undefined)
		max = 100;
	return Math.max(min,Math.min(max,val));
}

//Get a value from an object
function gObj(obj, elem) {
	if(typeof obj === 'undefined'){return false;}
	let i = elem.indexOf('.');
	if(i > -1) {
		return gObj(obj[elem.substring(0, i)], elem.substr(i + 1));
	}
	return obj[elem];
}
//Set a value from an object
function sObj(obj, elem, value) {
	if(typeof obj === 'undefined'){return false;}
	let i = elem.indexOf('.')
	if(i > -1) {
		return sObj(obj[elem.substring(0, i)], elem.substr(i + 1),value);
	}
	if(value !== undefined)
		obj[elem] = value;
	else
		delete obj[elem];
}
//Check if conditions are true or not (set of condition linked as "AND")
function checkCondition(conditions,charactersIds){
	let result = false;
	for(let condi of conditions){
		let infoChar = getCharacter(condi.who);
		let valToCheck = infoChar.get(condi.key);
		let tmpRes = false;
		switch(condi.cond){
			case ">=":tmpRes = (parseFloat(valToCheck) >= parseFloat(condi.value));break;
			case ">":tmpRes = (parseFloat(valToCheck) > parseFloat(condi.value));break;
			case "<=":tmpRes = (parseFloat(valToCheck) <= parseFloat(condi.value));break;
			case "<":tmpRes = (parseFloat(valToCheck) < parseFloat(condi.value));break;
			case "==":tmpRes = (parseFloat(valToCheck) == parseFloat(condi.value));break;
			case "!=":tmpRes = (parseFloat(valToCheck) != parseFloat(condi.value));break;
			case "is":tmpRes = (valToCheck == condi.value);break;
			case "isnot":tmpRes = (valToCheck != condi.value);break;
			case "in":
				if("object" == typeof condi.value)
					tmpRes = (arrayInter(valToCheck,condi.value).length > 0);
				else
					tmpRes = (valToCheck.indexOf(condi.value) !== -1);
				break;
			case "notin":
				if("object" == typeof condi.value)
					tmpRes = (arrayInter(valToCheck,condi.value).length == 0);
				else
					tmpRes = (valToCheck.indexOf(condi.value) === -1);
				break;
		}
		result = tmpRes;
		if(!result)
			break;
	}
	return result;
}
//Load the picture to test the size & apply the right video & class
function getPictDisplay(pict,videoSet,videoId){
	let testPict = new Image();
	testPict.src = pict;
	testPict.onload = function()
	{
		size = this.naturalHeight;
		if(size < 420){
			video = pickRandom(videoSet.horizontal);
			addClass(getId('div'+videoId),'displayHorizontal');
			getId(videoId).src = video;
			getId(videoId).load();
			removeClass(getId(videoId),'hide');
		}else{
			video = pickRandom(videoSet.vertical);
			addClass(getId('div'+videoId),'displayVertical');
			getId(videoId).src = video;
			getId(videoId).load();
			removeClass(getId(videoId),'hide');
		}

	}
}

//Display the media (img/video)
function imgVideo(mediaName,altName,textadd){
	let typeMedia = "";
	let testFind = mediaName.lastIndexOf('.');
	let result = '';
	if (mediaName.substr(testFind) == '.mp4')typeMedia = 'video';
	if (mediaName.substr(testFind) == '.webm')typeMedia = 'video';
	if (mediaName.substr(testFind) == '.gif')typeMedia = 'gif';

	if(altName === undefined)
		altName = '';

	let displayImg =  'All';	//TODO put that in settings

	if (displayImg == 'All'){
		if (typeMedia == 'video')
			result = '<video src="'+mediaName+'" title="'+altName+'" loop="loop" autoplay="autoplay"></video>';
		else
			result = '<img src="'+mediaName+'" class="imgDisplay" title="'+altName+'" alt="'+altName+'">';
	}else if(displayImg == 'Fix'){
		if (typeMedia == 'gif')
			mediaName = mediaName.substr(0,testFind)+'.jpg';
		result = '<img src="'+mediaName+'" class="imgDisplay" title="'+altName+'" alt="'+altName+'">';
	}else if(textadd !== undefined && textadd !== null){
		result = '<span>'+textadd+'</span>';
	}

	return result;		
}
//Play the transformation animation
function getTransfo(from,to){							
	return '<div class="transfoFace"><img class="transfoFrom" src="'+from+'"><img class="transfoTo" src="'+to+'"></div>';
}
//Play some hypno on picture
function getPictuHypno(pict,videoSet,videoId,classToUse = ''){
	getPictDisplay(pict,videoSet,videoId);
	let tmpVid = pickRandom(videoSet.horizontal);
	return '<div id="div'+videoId+'" class="pictuHypno '+classToUse+'"><img class="pictHypno" src="'+pict+'"><video id="'+videoId+'" class="vidHypno hide" src="'+tmpVid+'" loop="loop" autoplay="autoplay"></div>';
}
//Make the popup when buy stuff appear
function showBuyPopup(id){
	let player = getCharacter('player');
	let textPopup = getTrad('basic.bought',{'name':getTrad('buyable.'+id+'.name')});
	let timer = 3000;
	if(['boobsenlargement','boobsrejuv'].indexOf(id) !== -1){
		let pictsBoobsList = player.picturesTypes('topCloth');
		if(pictsBoobsList !== undefined){
			let pictBoobs = pictsBoobsList[pictsBoobsList.length -1];
			pictsBoobsList = player.picturesTypes('topCloth','oldBoobsSet');
			if(pictsBoobsList !== undefined){
				let oldBoobs = pictsBoobsList[pictsBoobsList.length -1];
				textPopup = getTransfo(oldBoobs,pictBoobs) + textPopup;
				timer = 7000;
			}
		}
	}

	showPopup(textPopup,'div-success',timer);
}

/******************************/
/********* MANAGER ************/
/******************************/

//PROFILES
	function getAllProfiles(){
		let profiles = window.localStorage.getItem(storagePrefix+'profiles');
		if(profiles === null)
			profiles = '{}';
		return JSON.parse(profiles);
	}
	function addProfile(id,data){
		let profiles = getAllProfiles();
		profiles[id] = data;
		window.localStorage.setItem(storagePrefix+'profiles',JSON.stringify(profiles));
	}
	function changeProfile(id){
		window.localStorage.setItem(storagePrefix+'profileId',id);profileId = id;
		manageProfileName();
		deleteStorage('characters');
		loadingStart();
		getId('main-gamewindow').style.display = 'none';
	}
	function getProfile(id){
		let profiles = getAllProfiles();
		return profiles[id];
	}
	function getProfileId(){return window.localStorage.getItem(storagePrefix+'profileId');}
	function getCurrentProfile(){
		let id = getProfileId();
		return getProfile(id);
	}
	function deleteProfile(id){
		let profiles = getAllProfiles();
		delete profiles[id];
		window.localStorage.removeItem(storagePrefix+id+'_backPage');
		window.localStorage.removeItem(storagePrefix+id+'_currentPage');
		window.localStorage.setItem(storagePrefix+'profiles',JSON.stringify(profiles));
	}
	function manageProfile(newProfil){
		profileId = getProfileId();

		let startEmpty = newProfil === undefined;

		if(profileId === null)
			newProfil = 'Default';

		//If no profile set, create one
		if(newProfil !== undefined){
			let id = newProfil.toLowerCase().replaceAll(' ','');
			let currentDate = new Date();
			currentDate = currentDate.toISOString().replace('T',' ').slice(0,-5);
			profileData = {
				"id":id,
				"name":newProfil,
				"created_at":currentDate,
				"played":0,
				"version":window.database.version
			};

			changeProfile(id);
			addProfile(id,profileData);
			setStorage('backPage','main-menu');

			if(!startEmpty){
				let from = getStorage('currentPage');
				showPage(from,'main-menu');
			}
		}
	}
	//Display Name of Profile
	function manageProfileName(){
		let infoProfile = getCurrentProfile();
		if(infoProfile !== undefined){
			getId('nameProfile').innerHTML = infoProfile.name;
		}else{
			getId('nameProfile').innerHTML = '';
		}
	}

//Settings
	function manageMenu(){
		//Manage Menu
		let menuDisplay = getId('menuDisplay');
		menuDisplay.innerHTML = '';
		for(let menuId in window.database.mainMenu){
			let menu = window.database.mainMenu[menuId];
			if(menuId == 'mainMenu-gamewindow' && getStorage('characters') === false)
				menuDisplay.innerHTML += '<li id="'+menuId+'" disabled="disabled"><div class="btn" disabled="disabled"><span class="icon '+menu.icon+'"></span>'+getTrad(menu.trad)+'</div></li>';
			else
				menuDisplay.innerHTML += '<li id="'+menuId+'"><div class="btn"><span class="icon '+menu.icon+'"></span>'+getTrad(menu.trad)+'</div></li>';
		}
		for(let menuId in window.database.mainMenu){
			let menu = window.database.mainMenu[menuId];
			let domMenu = getId(menuId);
			domMenu.onclick = function() {
				let isDisabled = this.getAttribute('disabled');
				if(isDisabled === null){
					window.scrollTo(0, 0);
					if(menu.method !== undefined){
						window[menu.method]();
					}else{
						let from = getStorage('currentPage');
						showPage(from,menu.page);
					}
				}
				return false;
			};
		}
	}
	function manageDarkMode(){
		if(setting('darkmode')){
			addClass(document.getElementsByTagName('body')[0],'darkmode');
			addClass(getId('mainOption-darkmode'),'icon-toggleOnR');
			removeClass(getId('mainOption-darkmode'),'icon-toggleOffR');
		}else{
			removeClass(document.getElementsByTagName('body')[0],'darkmode');
			addClass(getId('mainOption-darkmode'),'icon-toggleOffR');
			removeClass(getId('mainOption-darkmode'),'icon-toggleOnR');
		}
	}
	function manageSizePicture(){
		let sizepicture = setting('sizepicture');
		if(sizepicture === undefined || sizepicture === 'small'){
			removeClass(getId('pictsPlayer'),'mediumsize');
		}else{
			addClass(getId('pictsPlayer'),'mediumsize');
		}
	}
	function manageShowLogo(){
		if(setting('showlogo')){
			removeClass(getId('logoGame'),'hide');
		}else{
			addClass(getId('logoGame'),'hide');
		}
	}

	function manageLanguage(){
		language = setting('language');
		if(language === undefined)
			language = 'english';
	}

	//Define or give the setting
	function setting(name,value){
		let settings = getStorage('settings');

		if(settings == false){
			settings = {};
		}

		if(value === undefined){
			if(settings[name] === undefined && ['darkmode','showlogo','showpoints'].indexOf(name) !== -1)
				return true;
			return settings[name];
		}else{
			settings[name] = value;
			setStorage('settings',settings);
		}
	}

//Gather the text
	function getTradSub(code,nb = 1){
		let parts = code.split('.');
		let text = window.translation[language];
		let i=0;
		do {
			let tmp = text[parts[i++]];
			//If not find we do nothing
			if(tmp === undefined){
				text = code;
				break;
			}else{
				text = tmp;
			}
		} while (i < parts.length);

		if(text instanceof Array){
			if(nb > 1)
				text = pickRandom(text,nb);
			else
				text = pickRandom(text);
		}

		return text;
	}
	function doTrad(text,code,info){
		let regexText = /\|([^\|]+)\|/;
		let resMatch = regexText.exec(text);

		while (resMatch !== null) {
			let split = resMatch[1].split('.');
			let replace = '';

			if(info !== undefined && info[resMatch[1]] !== undefined){
				replace = info[resMatch[1]];
				replace = getTrad(replace);
			}else if(info !== undefined && (info[split[0]] !== undefined||info.firstname !== undefined)){
				let charInfo = (info[split[0]] !== undefined ? info[split[0]] : info);
				let selector = (info[split[0]] !== undefined ? split[1] : resMatch[1]);
				switch(selector){
					case 'firstnameReal':
						replace = (charInfo.firstnameMan !== undefined ? charInfo.firstnameMan : charInfo.firstname);
						break;
					case 'formal':
						replace = ucfirst(charInfo.gender == 'man'?getTrad('peoplestuff.mr'):getTrad('peoplestuff.miss'))+' '+charInfo.lastname;
						break;
					case 'self':
						replace = (charInfo.gender == 'man'?getTrad('peoplestuff.himself'):getTrad('peoplestuff.herself'));
						break;
					case 'pronoun':
						replace = (charInfo.gender == 'man'?getTrad('peoplestuff.him'):getTrad('peoplestuff.her'));
						break;
					case 'smallgender':
						replace = (charInfo.gender == 'man'?getTrad('peoplestuff.boy'):getTrad('peoplestuff.girl'));
						break;
					case 'fungender':
						replace = (charInfo.gender == 'man'?getTrad('peoplestuff.guy'):getTrad('peoplestuff.gal'));
						break;
					case 'subject':
						replace = (charInfo.gender == 'man'?getTrad('peoplestuff.he'):getTrad('peoplestuff.she'));
						break;
					case 'job':
						replace = getTrad('profile.jobs.'+charInfo.job);
						break;
					case 'ianame':
						replace = window.database.ia.iaName;
						break;
					default:
						replace = gObj(info,resMatch[1]);
						break;
				}
			}else{
				switch(resMatch[1]){
					case 'ianame':
						replace = window.database.ia.iaName;
						break;
					case 'partDay':
						replace = getTrad('basic.time.'+getStorage('timeDay'));
						break;
				}
			}

			text = text.replace(resMatch[0],replace);

			if(language == 'english')
				text = text.replace("s's","s'");

			resMatch = regexText.exec(text);
		}

		text = getTradParseTrad(text);

		return text;
	}
	function getTrads(code,nb,info){
		if(typeof code !== 'string')
			return code;
		let texts = getTradSub(code,nb);

		let textsFinal = [];
		for(let text of texts){
			textsFinal.push(doTrad(text,code,info));
		}

		return textsFinal;
	}
	//Translation
	function getTrad(code,info){
		if(code instanceof Array)
			code = pickRandom(code);
		if(typeof code !== 'string')
			return code;

		let text = getTradSub(code);

		return doTrad(text,code,info);
	}
	//Translate a page by parsing elements
	function translatePage(pageId){
		let elems = getId(pageId).getElementsByClassName('trad');
		for(let i=0;i<elems.length;i++){
			let tradCode = elems[i].getAttribute('data-trad');
			let text = getTrad(tradCode);
			let options = elems[i].getAttribute('data-option');
			let location = elems[i].getAttribute('data-location');
			if(options !== null){
				options = options.split(',');
				if(options.indexOf('upper') != -1){
					text = text.toUpperCase();
				}else if(options.indexOf('ucfirst') != -1){
					text = ucfirst(text);
				}
			}
			if(location === null||location == 'inner')
				elems[i].innerHTML = text;
			else if(location == 'title')
				elems[i].setAttribute('title',text);
		}
	}
	//Do look for additional trad
	function getTradParseTrad(text){
		let regexText = /\[maj:([^\]]+)\]/g;
		let tmpRes;
		let replaceList = [];
		while ((tmpRes = regexText.exec(text)) !== null) {
			replaceList.push(tmpRes[0]);
		}
		replaceList = [...new Set(replaceList)];	//Delete Dupe
		if(replaceList.length > 0){
			for(let element of replaceList){
				let tmpPart = element.substr(5,element.length-6);
				text = text.replaceAll(element,majText(tmpPart));
			}
		}

		regexText = /\[trad:([^\]]+)\]/g;
		replaceList = [];
		while ((tmpRes = regexText.exec(text)) !== null) {
			replaceList.push(tmpRes[0]);
		}
		replaceList = [...new Set(replaceList)];	//Delete Dupe
		if(replaceList.length > 0){
			for(let element of replaceList){
				let tmpPart = element.substr(6,element.length-7);
				text = text.replace(element,getTrad(tmpPart));
			}
		}

		regexText = /\[func:([^\]]+)\]/g;
		replaceList = [];
		while ((tmpRes = regexText.exec(text)) !== null) {
			replaceList.push(tmpRes[0]);
		}
		replaceList = [...new Set(replaceList)];	//Delete Dupe
		if(replaceList.length > 0){
			for(let element of replaceList){
				let tmpPart = element.substr(6,element.length-7);
				tmpPart = tmpPart.split('¤');
				text = text.replace(element,window[tmpPart[0]](tmpPart[1],tmpPart[2]));
			}
		}

		return text;
	}
	//Hide & Show Pages
	function showPage(hide,show){
		translatePage(show);

		if(hide == false){
			let sections = document.getElementsByTagName('section');
			for(let i=0;i<sections.length;i++){
				sections[i].style.display = 'none';
			}
		}else{
			getId(hide).style.display = 'none';
		}
		getId(show).style.display = 'flex';

		if(window.localStorage != {}){
			setStorage('currentPage',show);

			//Avoid loading page and loop
			if(hide != 'loading' && hide != show)
				setStorage('backPage',hide);
		}

		//Clean after
		if(hide == 'dailyPage' && show != 'dailyPage'){
			getId('dailyDream').querySelector('content').innerHTML = '';
			getId('dailyFun').querySelector('content').innerHTML = '';
			getId('dailyRecap').querySelector('content').innerHTML = '';
			getId('dailyFolio').querySelector('content').innerHTML = '';
			getId('dailyHypno').querySelector('content').innerHTML = '';
		}
		if(hide == 'storyPage' && show != 'storyPage'){
			getId('storyPage').innerHTML = '';
		}

		renderStuff();
	}
	function sayingGoodDay(){
		let timeDay = getStorage('timeDay');
		switch(timeDay){
			case 'morning':return getTrad('basic.goodmorning');break;
			case 'noon':return getTrad('basic.salutation');break;
			case 'afternoon':return getTrad('basic.goodafternoon');break;
			case 'evening':return getTrad('basic.goodevening');break;
			case 'night':return getTrad('basic.goodnight');break;
		}
	}
	function dualPicture(img1,img2){
		if(img1 == 'hallway'){
			let villa = getStorage('villa');
			img1 = villa.hallway;
		}else if(img1 == 'ROOMPICT'){
			img1 = getRoomPicture(getStorage('currentLocation'));
		}

		return '<div class="centerContent dualPicture">'+imgVideo(img1)+imgVideo(img2)+'</div>';
	}
	function sayIf(arg1,arg2){
		let list = {};
		if(arg2 !== undefined){
			list[arg1] = arg2;
		}else{
			list = JSON.parse(arg1);
		}

		let player = getCharacter('player');
		for(let type in list){
			let text = list[type];
			if(type == 'bimboHigh' && player.get('bimbo') >= 75)
				return getTrad(text);
			if(type == 'bimboMid' && player.get('bimbo') >= 50)
				return getTrad(text);
			if(type == 'bimboStart' && player.get('bimbo') >= 25)
				return getTrad(text);
			if(type == 'bimboLow' && player.get('bimbo') < 25)
				return getTrad(text);

			if(type == 'slutHigh' && player.get('slut') >= 75)
				return getTrad(text);
			if(type == 'slutMid' && player.get('slut') >= 50)
				return getTrad(text);
			if(type == 'slutStart' && player.get('slut') >= 25)
				return getTrad(text);
			if(type == 'slutLow' && player.get('slut') < 25)
				return getTrad(text);

			if(type == 'exitedHigh' && player.giveExitation() >= 75)
				return getTrad(text);
			if(type == 'exitedMid' && player.giveExitation() >= 50)
				return getTrad(text);
			if(type == 'exitedStart' && player.giveExitation() >= 25)
				return getTrad(text);
			if(type == 'exitedLow' && player.giveExitation() < 25)
				return getTrad(text);
		}

		return '';
	}

//If the page had a method , execute it
function methodPage(currentPage){
	try {
		let elementId = currentPage.replace('main-','mainMenu-');
		if(window.database.mainMenu[elementId] !== undefined){
			if(window.database.mainMenu[elementId].method !== undefined){
				window[window.database.mainMenu[elementId].method]();
			}else{
				let from = getStorage('currentPage');
				showPage(from,window.database.mainMenu[elementId].page);
			}
		}else if(window.database.pagesOther[currentPage] !== undefined){
			window[window.database.pagesOther[currentPage].method]();
		}
	}catch(error){
		console.log('error3',error);
		showError(error);
		let from = getStorage('currentPage');
		showPage(from,'main-menu');
	}
}

//First Loading
function loadingStart(){
	manageProfile();
	manageLanguage();
	manageDarkMode();
	manageSizePicture();
	manageShowLogo();
	manageMenu();
	manageProfileName();

	//Set up the setting
	if(setting('participantsDisabled') === undefined){
		let strikeThem = [];
		for(let id in window.database.participants){
			let info = window.database.participants[id];
			if(info.uncheck !== undefined && info.uncheck){
				strikeThem.push(id);
			}
		}
		setting('participantsDisabled',strikeThem);
	}

	if(window.location.href.indexOf('reset=1') !== -1)
		clearStorage();
	else if(window.location.href.indexOf('reset=2') !== -1)
		cleanStorage('all');	//all except the saves
	else
		loadStateGame();

	//Display the page
	let currentPage = getStorage('currentPage');
	if(currentPage === false){
		currentPage = 'main-menu';
	}else{
		if(getStorage('playNextDay'))
			currentPage = 'dailyPage';
		methodPage(currentPage);
	}

	if(currentPage !== 'main-gamewindow'){
		getId('main-gamewindow').style.display = 'none';	
	}
	showPage('loading',currentPage);
}

function activatePageTabs(pageId){
	let btnSwitch = getId(pageId).querySelectorAll('.subPageTitle div:not(.hide)');
	for(let btnHere of btnSwitch){
		removeClass(btnHere,'firstChild');
		removeClass(btnHere,'lastChild');
		btnHere.onclick = function() {
			let target = this.getAttribute('data-target');
			let btnAll = getId(pageId).querySelectorAll('.subPageTitle div');
			for(let btn of btnAll){
				removeClass(btn,'selected');
			}
			addClass(this,'selected');

			let contents = getId(pageId).querySelectorAll('content');
			for(let cont of contents){
				removeClass(cont,'hide');
				addClass(cont,'hide');
			}
			let contentHere = getId(target);
			removeClass(contentHere,'hide');
		};
	}

	//Style
	addClass(btnSwitch[0],'firstChild');
	addClass(btnSwitch[btnSwitch.length-1],'lastChild');
}

function characterShortInfo(charId,addClass = ''){
	let charInfo = getCharacter(charId);
	let role = majText(getTrad('role.'+charInfo.role+'.single'));
	let name = (charInfo.publicInfo.name ? charInfo.firstname+' '+charInfo.lastname : majText(getTrad('basic.unknown')));
	let detail = [];
	let age = (charInfo.publicInfo.age ? charInfo.age+' '+getTrad('backgroundsparts.yearsold') : ( charInfo.publicInfo.seeFace ? majText(getTrad('agerange.'+charInfo.ageRange)) : '' ));
	if(age !== '')
		detail.push(age);
	let gender = (charInfo.publicInfo.gender ? getTrad('characterinfo.gender.'+charInfo.gender) : ( charInfo.publicInfo.seeFace ? (charInfo.gender == 'man' ? getTrad('characterinfo.gender.man') : getTrad('characterinfo.gender.woman')) : '' ));
	if(gender !== '')
		detail.push(gender);
	let face = (charInfo.publicInfo.seeFace ? charInfo.bodypart.face.pict : (charInfo.publicInfo.gender ? ( charInfo.gender == 'man' ? window.database.characterInfo.pictDefaultMan : window.database.characterInfo.pictDefaultWoman ) : 'data/img/icon/icon-question2.svg'));
	let classImg = (face == 'data/img/icon/icon-question2.svg' ? 'faceUnknown' : '');

	return '<div class="smallDetailChar '+addClass+'" data-id="'+charId+'" title="'+name+'">'+
				'<img class="'+classImg+'" src="'+face+'" alt="'+name+' picture">'+
				'<div class="role">'+role+'</div>'+
				'<div class="name">'+name+'</div>'+
				'<div class="detail">'+detail.join(' ')+'</div>'+
			'</div>';
}
function characterShortInfoControl(elementId){
	let listChar = getId(elementId).querySelectorAll('.smallDetailChar');
	listChar.forEach(function(element){
		element.onclick = function(e) {
			let idChar = this.getAttribute('data-id');
			characterDetails(idChar);
		}
	});
}

function archetypeDispo(type){
	let participantsDisabled = setting('participantsDisabled');
	if(participantsDisabled === undefined || participantsDisabled === false)
		participantsDisabled = [];

	let housemates = getHousemateId('everyone');
	let alreadyUsed = [];
	if(housemates.length > 0){
		for(let housemateId of housemates){
			let housemate = getCharacter(housemateId);
			alreadyUsed.push(housemate.archetype);
		}
	}

	let archetypeAvailables = [];
	let participants = window.database.participants;
	for(let participantId in participants){
		let participant = participants[participantId];

		if(participantsDisabled.length > 0 && participantsDisabled.indexOf(participantId) !== -1)
			continue;

		//If currently use don't take it
		if(type !== undefined && type == 'available' && alreadyUsed.indexOf(participantId) !== -1)
			continue;

		archetypeAvailables.push(participantId);
	}
	return archetypeAvailables;
}

function discuss(pict,name,text){
	return '<div class="discussLine">'+
				(pict !== undefined ? '<div class="discussPict">'+imgVideo(pict)+'</div>' : '')+
				'<div class="discussZone">'+
					'<div class="discussName">'+name+'</div>'+
					'<div class="discussText">'+text+'</div>'+
				'</div>'+
			'</div>';
}

//Determine the level (fleme to seek the good expression ^^)
function giveHypnoLvl(){
	let dayNumber = getStorage('dayNumber') - 1;

	let speed = window.database.difficulty[getStorage('difficulty')].hypno.speed;

	let simpleProb = 0;
	let softProb = 0;
	let standardProb = 0;
	let hardProb = 0;
	if(dayNumber < speed[0]){
		simpleProb = -30*dayNumber/(speed[0]/2) + 60;
		softProb = 15*dayNumber/(speed[0]/2) + 30;
		standardProb = 9*dayNumber/(speed[0]/2) + 7;
	}else if(dayNumber < speed[0]+speed[1]){
		softProb = -30*(dayNumber-speed[0])/(speed[1]/2)+60;
		standardProb = 20*(dayNumber-speed[0])/(speed[1]/2)+25;
	}else{
		standardProb = -22.5*(dayNumber-speed[0]-speed[1])/(speed[2]/2)+65;
	}
	hardProb = 100 - (simpleProb+softProb+standardProb);

	simpleProb = normalize(Math.round(simpleProb),0,100);
	softProb = normalize(Math.round(softProb),0,100);
	standardProb = normalize(Math.round(standardProb),0,100);
	hardProb = normalize(Math.round(hardProb),0,100);

	let proba = {
		"simple":[0,simpleProb],
		"soft":[simpleProb,simpleProb+softProb],
		"standard":[simpleProb+softProb,simpleProb+softProb+standardProb],
		"hard":[simpleProb+softProb+standardProb,100],
	};
	let hypnoLvlKept = null;
	let randomPick = random(0,100);

	for(let hypnoLvl in proba){
		let prob = proba[hypnoLvl];
		if(prob[0] <= randomPick && randomPick <= prob[1]){
			hypnoLvlKept = hypnoLvl;
			break;
		}
	}

	return hypnoLvlKept;
}

//Load stuff
document.addEventListener('DOMContentLoaded', (event) => {
	if(window.location.pathname.indexOf('reset=1') != -1)
		clearStorage();

	//Popup show the first time and each reset
	if(window.localStorage['popupStart'] === undefined){
		translatePage('popupStart');
		removeClass(getId('popupStart'),'hide');
	}
	getId('closePopupStart').onclick = function(){
		addClass(getId('popupStart'),'hide');
		window.localStorage.setItem('popupStart',1);
	};

	getId('titleGame').onclick = function(){
		translatePage('popupStart');
		removeClass(getId('popupStart'),'hide');
	};

	//If we start the game, the currentPage is the Menu
	if(window.localStorage != {} && window.starting !== undefined){
		setStorage('currentPage','main-menu');
		delete window.starting;
	}

	loadingStart();

	//Popup Close
	getId('popup').onclick = function(){
		addClass(getId('popup'),'hide');
	}

	//Btn Refresh All
	let btnRefreshAll = getId('btnRefreshAll');
	if(btnRefreshAll !== undefined && btnRefreshAll !== null){
		btnRefreshAll.onclick = function(){
			menuGame();
			continueGame();
		};
	}

	//Back Btn
	let backBtn = document.getElementsByClassName('backBtn');
	backBtn = Array.prototype.slice.call( backBtn );
	backBtn.forEach(function(element){
		element.onclick = function() {
			let current = getStorage('currentPage');
			let previous = getStorage('backPage');

			let target = this.getAttribute('data-target');
			if(target !== undefined && target !== null)
				previous = target;

			if(previous == false || previous == current)
				previous = 'main-menu';

			getId('popup').innerHTML = '';
			addClass(getId('popup'),'hide');

			showPage(current,previous);
			return false;
		};
	});

	//Btn swtich part Continue / Next
	let changeSteps = document.getElementsByClassName('changeStep');
	changeSteps = Array.prototype.slice.call( changeSteps );
	changeSteps.forEach(function(element){
		element.onclick = function() {
			let idCurrent = this.getAttribute('data-current');
			if(idCurrent != null){
				let elem = getId(idCurrent);
				addClass(elem,'hide');
				removeClass(elem,'show');
			}
			let idOther = this.getAttribute('data-other');
			if(idOther != null){
				elem = getId(idOther);
				window.scrollTo(0, 0);
				addClass(elem,'show');
				removeClass(elem,'hide');
			}

			try{
				btnStepControl(this);
			}catch(error){
				console.log('error6',error);
				showError(error);
				let from = getStorage('currentPage');
				showPage(from,'main-menu');
			}
		};
	});
});


/***************************/
/*********** PAGES *********/
/***************************/

	function optionPage(){
		let from = getStorage('currentPage');
		showPage(from,'main-options');

		//Give the Participants Data
		function dataParticipants(charId){
			let data = window.database.participants[charId];
			let info = [];
			let face;
			let errors = [];
			info.push('<u>'+getTrad('optionmenu.checkdata.name')+'</u> '+data.name);
			info.push('<u>'+getTrad('optionmenu.checkdata.haircolor')+'</u> '+getTrad('basic.color.'+data.hairColor));
			info.push('<u>'+getTrad('optionmenu.checkdata.typebody')+'</u> '+data.typeBody);
			info.push('<u>'+getTrad('optionmenu.checkdata.sizeboobs')+'</u> '+data.sizeBoobs);
			info.push('<u>'+getTrad('optionmenu.checkdata.agerange')+'</u> '+data.ageRange.join('-'));

			//Check Faces
				if(data.picts === undefined||Object.keys(data.picts).length != 6){
					info.push('<u>'+getTrad('optionmenu.checkdata.faces')+'</u> <span class="badThing">Error</span>');
					errors.push('No Faces');
				}else{
					info.push('<u>'+getTrad('optionmenu.checkdata.faces')+'</u> <span class="goodThing">Ok</span>');
				}
				if(data.picts !== undefined && data.picts.base !== undefined)
					face = data.picts.base;

			//Check Hypno Pictures
				if(data.hypnoPicts === undefined||data.hypnoPicts.length == 0){
					info.push('<u>'+getTrad('optionmenu.checkdata.hypnopicts')+'</u> <span class="badThing">No Pics</span>');
					errors.push('No Hypno Pictures');
				}else{
					info.push('<u>'+getTrad('optionmenu.checkdata.hypnopicts')+'</u> <span class="goodThing">'+data.hypnoPicts.length+'</span>');
				}

			//Check Perks
				let perks = [];
				if(data.perks !== undefined && data.perks.length > 0){
					for(let perkId of data.perks){
						perks.push(getTrad('perks.'+perkId+'.name'));
					}
				}
				if(perks.length == 0){
					info.push('<u>'+getTrad('optionmenu.checkdata.perks')+'</u> <span class="badThing">None</span>');
					errors.push('No Perks');
				}else{
					info.push('<u>'+getTrad('optionmenu.checkdata.perks')+'</u> <span class="goodThing">'+perks.join(' / ')+'</span>');
				}

			//Check Album
				let nbAlbumType = 0;
				let nbAlbumPics = 0;
				if(data.album !== undefined){
					for(let elemId in data.album){
						if(data.album[elemId].length > 0){
							nbAlbumType++;
							nbAlbumPics += data.album[elemId].length;
						}
					}
				}
				if(nbAlbumType == 0){
					info.push('<u>'+getTrad('optionmenu.checkdata.albumtypes')+'</u> <span class="badThing">0</span>');
					errors.push('No Album Type');
				}else{
					info.push('<u>'+getTrad('optionmenu.checkdata.albumtypes')+'</u> <span class="goodThing">'+nbAlbumType+'</span>');
				}
				if(nbAlbumPics == 0){
					info.push('<u>'+getTrad('optionmenu.checkdata.albumpics')+'</u> <span class="badThing">0</span>');
					errors.push('No Album Pictures');
				}else{
					info.push('<u>'+getTrad('optionmenu.checkdata.albumpics')+'</u> <span class="goodThing">'+nbAlbumPics+'</span>');
				}

			//Check Cams Pictures
				let camsPhoto = 0;
				if(data.camsPhoto !== undefined && Object.keys(data.camsPhoto).length > 0){
					for(let elemId in data.camsPhoto){
						if(Object.keys(data.camsPhoto[elemId]).length == 5)
							camsPhoto++;
					}
				}
				if(camsPhoto == 0){
					info.push('<u>'+getTrad('optionmenu.checkdata.camsphoto')+'</u> <span class="badThing">None</span>');
					errors.push('No Strips Pictures');
				}else{
					info.push('<u>'+getTrad('optionmenu.checkdata.camsphoto')+'</u> <span class="goodThing">'+camsPhoto+'</span>');
				}
			
			//Check Profiles Pictures
				let profilePicts = 0;
				if(data.profilePicts !== undefined && Object.keys(data.profilePicts).length > 0){
					for(let elemId in data.profilePicts){
						if(data.profilePicts[elemId].length == 6)
							profilePicts++;
					}
				}
				if(profilePicts == 0){
					info.push('<u>'+getTrad('optionmenu.checkdata.profilepicts')+'</u> <span class="badThing">None</span>');
					errors.push('No Profiles Pictures');
				}else{
					info.push('<u>'+getTrad('optionmenu.checkdata.profilepicts')+'</u> <span class="goodThing">'+profilePicts+'</span>');
				}

			//Check inHallWay Pictures
				let inHallway = 0;
				if(data.inHallway !== undefined && Object.keys(data.inHallway).length > 0){
					for(let elemId in data.inHallway){
						if(Object.keys(data.inHallway[elemId]).length >= 2)
							inHallway++;
					}
				}
				if(inHallway == 0){
					info.push('<u>'+getTrad('optionmenu.checkdata.inhallway')+'</u> <span class="badThing">None</span>');
					errors.push('No inHallWay Pictures');
				}else{
					info.push('<u>'+getTrad('optionmenu.checkdata.inhallway')+'</u> <span class="goodThing">'+inHallway+'</span>');
				}
			
			//Check Activities
				info.push('<b><u>'+getTrad('optionmenu.checkdata.activities')+'</u></b>');
				for(let locaId in window.database.locations){
					for(let activityId in window.database.locations[locaId].activities){
						let setDisp = 0;
						if(data.activities !== undefined && data.activities[activityId] !== undefined && Object.keys(data.activities[activityId]).length > 0){
							for(let setId in data.activities[activityId]){
								if(data.activities[activityId][setId].length == 5)
									setDisp++;
							}
						}
						if(setDisp == 0){
							info.push('<u>'+activityId+'</u> <span class="badThing">Missing</span>');
							errors.push('Activity '+activityId+': Missing');
						}else{
							info.push('<u>'+activityId+'</u> <span class="goodThing">'+setDisp+'</span>');
						}
					}
				}
			
			return {"face":face,"info":info,"errors":errors};
		}

		//Give the Dreams Data
		function dataDreams(charId){
			let data = window.database.morning.dreams[charId];
			let info = [];
			let errors = [];
			//Conditions
				if(data.conditions !== undefined && Object.keys(data.conditions).length > 0){
					for(let id in data.conditions){
						let condition = data.conditions[id];
						if(id == 'wasMan'){
							if(condition)
								info.push('Need to start as a Man');
							else
								info.push('Need to start as a Woman');
						}else if(id == 'bimbo')
							info.push('Need to have a bimbo lvl between '+condition.join('-'));
						else if(id == 'slut')
							info.push('Need to have a slut lvl between '+condition.join('-'));
						else if(id == 'dream'){
							let line = [];
							for(let key of condition){
								line.push(getTrad('morning.dreams.'+key+'.title'));
							}
							info.push('Need to have already dream of: '+line.join(' / '));
						}else if(id == 'notdream'){
							let line = [];
							for(let key of condition){
								line.push(getTrad('morning.dreams.'+key+'.title'));
							}
							info.push('<u>Must not have those Dreams:</u> '+line.join(' / '));
						}else if(id == 'version')
							info.push('Need a new game with the '+condition+' version');
						else if(id == 'items'){
							let line = [];
							for(let itemId in condition){
								line.push(itemId+' with at lvl:'+condition[itemId].join(','));
							}
							info.push('<u>Need those items:</u> '+line.join(' / '));
						}else if(id == 'notPerks'){
							let line = [];
							for(let key of condition){
								line.push(getTrad('perks.'+key+'.name'));
							}
							info.push('<u>Must not have those perks:</u> '+line.join(' / '));
						}
					}
				}
			return {"info":info,"errors":errors};
		}

		//Load language
			let languageSelect = getId('language-choose');
			if(languageSelect !== undefined && languageSelect !== null){
				languageSelect.innerHTML = '';
				let languagesList = Object.keys(window.translation);
				for(let i=0;i<languagesList.length;i++){
					let newOption = document.createElement('option');
					let optionText = document.createTextNode(languagesList[i].toUpperCase());
					newOption.appendChild(optionText);
					newOption.setAttribute('value',languagesList[i]);

					if(languagesList[i] == language)
						newOption.setAttribute('selected','selected');

					languageSelect.appendChild(newOption);
				}
				languageSelect.onchange = function(e) {
					let opts = languageSelect.options;
					let value = opts[opts.selectedIndex].getAttribute('value');
					language = value;
					setting('language',value);
					showPage('main-options',from);
					location.reload();
					return false;
				};
			}

		//Checkable
			let elementsOptionCheckable = [
				'darkmode',
				'showlogo',
				'showlogo',
				'highlightchange',
				'progressnumber',
				'perksinfluence',
				'currentinfluence',
				'corruptpoint',
				'clueaction',
				'showpoints',
			];
			for(let elem of elementsOptionCheckable){
				let elemId = 'mainOption-'+elem;
				let element = getId(elemId);
				if(element !== null){
					let settingVal = setting(elem);
					if(settingVal|| (['darkmode','showlogo','showpoints'].indexOf(elem) !== -1 && settingVal === undefined)){
						addClass(element,'icon-toggleOnR');
						removeClass(element,'icon-toggleOffR');
					}else{
						removeClass(element,'icon-toggleOnR');
						addClass(element,'icon-toggleOffR');
					}

					element.onclick = function() {
						toggleClass(this,'icon-toggleOffR');
						toggleClass(this,'icon-toggleOnR');
						setting(elem,haveClass(this,'icon-toggleOnR'));
						if(elem == 'darkmode'){
							toggleClass(document.getElementsByTagName('body')[0],'darkmode');
						}else if(elem == 'showlogo'){
							manageShowLogo();
						}
						if(getStorage('characters') !== false){
							menuGame();
						}
						return false;
					};
				}
			}

		//Choices
			let elementsOptionChoice = [
				'defeatedhousemate',
				'activitydisplay',
				'sizepicture',
				'speedvideo',
			];
			for(let elem of elementsOptionChoice){
				let elemClass = 'mainOption-'+elem;
				let elements = getId('main-options').querySelectorAll('.'+elemClass);
				let currentValue = setting(elem);

				if(currentValue === undefined){
					let valueDefault = elements[0].getAttribute('data-value');
					getId(elem+'Desc').innerHTML = getTrad('optionmenu.'+elem+valueDefault.replace('.','')+'desc');
				}else{
					getId(elem+'Desc').innerHTML = getTrad('optionmenu.'+elem+currentValue.replace('.','')+'desc');
				}

				elements.forEach(function(element){
					if(currentValue){
						removeClass(element,'selected');
						let elemValue = element.getAttribute('data-value');
						if(elemValue == currentValue){
							addClass(element,'selected');
						}
					}

					element.onclick = function() {
						removeClass(getId('main-options').querySelector('.'+elemClass+'.selected'),'selected');
						addClass(this,'selected');
						let newValue = this.getAttribute('data-value');
						setting(elem,newValue);
						getId(elem+'Desc').innerHTML = getTrad('optionmenu.'+elem+newValue.replace('.','')+'desc');
						if(elem == 'sizepicture'){
							manageSizePicture();
						}else if(elem == 'speedvideo'){
							renderStuff();
						}
						if(getStorage('characters') !== false){
							menuGame();
						}
						return false;
					};
				});
			}

		//Reset
			getId('mainOption-resetAll').onclick = function() {
				if(confirm(getTrad('optionmenu.resetallconfirm'))){
					showPage('main-options','main-menu');
					clearStorage();
					location.reload();
				}
				return false;
			};
			getId('mainOption-resetGame').onclick = function() {
				if(confirm(getTrad('optionmenu.resetgameconfirm'))){
					showPage('main-options','main-menu');
					cleanStorage('all');	//So all but not saves
					location.reload();
				}
				return false;
			};

		activatePageTabs('main-options');

		//GamePlay Elements
		function loadSelectElements(type){
			let listElement = getId('list'+ucfirst(type));

			let isSet = listElement.getAttribute('data-isSet');
			let path = listElement.getAttribute('data-path');
			if(path === null)
				path = type;
			let optionFeature = listElement.getAttribute('data-feature');
			if(optionFeature === null)
				optionFeature = 'Disabled';

			let elementsDisabled = setting(type+optionFeature);
			if(elementsDisabled === undefined){
				if(optionFeature == 'Disabled')
					elementsDisabled = [];
				else
					elementsDisabled = {};
			}
			let elementToShow = [];
			let listOfType = {};

			let elementData = clone(gObj(window.database,path));
			if(isSet !== null){
				let tmpData = {};
				for(let typeId in elementData){
					if(typeId == 'man')
						continue;

					listOfType[typeId] = 0;

					for(let setId in elementData[typeId]){
						let key = typeId+'_'+setId;
						tmpData[key] = elementData[typeId][setId];
						tmpData[key].typeSet = typeId;
						listOfType[typeId]++;
					}
				}
				elementData = tmpData;
			}

			//Display Info
			if(Object.keys(listOfType).length > 0 && getId('info'+ucfirst(type)) !== null){
				getId('info'+ucfirst(type)).innerHTML = '';
				let tmpData = [];
				for(let id in listOfType){
					if(listOfType[id] <= 0)
						continue;
					tmpData.push(id+': '+listOfType[id]);
				}
				getId('info'+ucfirst(type)).innerHTML = tmpData.join(' / ');
			}

			for(let dataId in elementData){
				let data = elementData[dataId];
				let name = dataId;
				switch(type){
					case 'participants':
						name = data.name;
						break;
					case 'events':
						name = getTrad('events.'+dataId+'.name');
						break;
					default:
						let testTrad = getTrad(path+'.'+dataId+'.title');
						if(testTrad != path+'.'+dataId+'.title')
							name = testTrad;
						break;
				}

				let addLineContent = '';
				let additionnalPart = '';
				if(type == 'participants'){
					let infoData = dataParticipants(dataId);
					if(infoData.errors.length > 0)
						addLineContent = ' <span class="pointerInfo icon icon-danger2R" title="Errors:&#013;-'+infoData.errors.join('&#013;-')+'"></span>';
					additionnalPart = '<li class="detailOptions hide" data-id="'+dataId+'">'+
											(infoData.face !== undefined ? imgVideo(infoData.face) : '')+
											'<ul><li>'+infoData.info.join('</li><li>')+'</li></ul>'+
										'</li>';
				}else if(type == 'dreams'){
					let infoData = dataDreams(dataId);
					if(infoData.info.length > 0)
						additionnalPart = '<li class="detailOptions hide" data-id="'+dataId+'"><ul><li>'+infoData.info.join('</li><li>')+'</li></ul></li>';
				}else if(['clothtop','clothbottom'].indexOf(type) !== -1){
					let listOption = [];
					for(let typeId in listOfType){
						if(elementsDisabled[dataId] !== undefined && elementsDisabled[dataId] == typeId)
							listOption.push('<option selected="selected" value="'+typeId+'">'+typeId+'</option>');
						else if((elementsDisabled[dataId] === undefined || elementsDisabled[dataId] == '') &&  dataId.indexOf(typeId) !== -1)
							listOption.push('<option selected="selected" value="'+typeId+'">'+typeId+'</option>');
						else
							listOption.push('<option value="'+typeId+'">'+typeId+'</option>');
					}
					addLineContent = '<br><img src="'+data[0]+'">'+'<select data-id="'+dataId+'" data-type="'+type+'" class="chooseOption">'+listOption.join('')+'</select>';
				}else if(type == 'events'){
					let infoEvent = window.database.events[dataId];
					let testTrad = getTrad(path+'.'+dataId+'.desc');
					if(testTrad !== path+'.'+dataId+'.desc')
						addLineContent = '<br><i>'+getTrad(path+'.'+dataId+'.desc')+'</i>';
					let chanceDisplay = [];
					if(infoEvent.chance !== undefined){
						for(let diffId in infoEvent.chance){
							chanceDisplay.push(getTrad('newgame.difficulty.'+diffId)+': '+infoEvent.chance[diffId]+'%');
						}
						addLineContent += '<br><i style="font-size:0.5em;">'+chanceDisplay.join(' / ')+'</i>';
					}
				}else{
					let testTrad = getTrad(path+'.'+dataId+'.desc');
					if(testTrad !== path+'.'+dataId+'.desc')
						addLineContent = '<br><i>'+getTrad(path+'.'+dataId+'.desc')+'</i>';
				}

				let isOff = false;
				if(optionFeature == 'Disabled' && elementsDisabled.indexOf(dataId) != -1)
					isOff = true;
				else if(elementsDisabled[dataId] !== undefined && elementsDisabled[dataId] === '')
					isOff = true;

				if(isOff){
					elementToShow.push('<li class="elemOptions" data-id="'+dataId+'">'+name+'<span class="icon icon-toggleOffR" data-id="'+dataId+'" data-type="'+type+'"></span>'+addLineContent+'</li>');
				}else{
					elementToShow.push('<li class="elemOptions" data-id="'+dataId+'">'+name+'<span class="icon icon-toggleOnR" data-id="'+dataId+'" data-type="'+type+'"></span>'+addLineContent+'</li>');
				}

				if(additionnalPart !== '')
					elementToShow.push(additionnalPart);
			}

			listElement.innerHTML = '';
			if(elementToShow.length > 0){
				listElement.innerHTML = elementToShow.join('');
			}
			controlSelectElements(type);
		}
		loadSelectElements('events');
		loadSelectElements('participants');
		loadSelectElements('clothtop');
		loadSelectElements('clothbottom');
		loadSelectElements('dreams');

		//Bars
		let bars = document.getElementsByClassName('bar-border');
		for(let i=0;i < bars.length;i++){
			
			let currSettingBar = setting(bars[i].id);
			if(currSettingBar === undefined){
				let valReset = bars[i].parentNode.getAttribute('data-path');
				currSettingBar = gObj(clone(window.database),valReset)+'%';
			}
			let elemBar = bars[i].firstElementChild;
			elemBar.style.width = currSettingBar;
			elemBar.innerHTML = currSettingBar;

			bars[i].onmousedown = function(ev) {
				isMousedown = true;
				changeBarValue(ev);
			}
			bars[i].onmouseup = function(ev) {
				isMousedown = false;
				let elem = ev.target.closest('.bar-border');
				let value = elem.getElementsByClassName('bar-content')[0].innerHTML;
				setting(elem.id,value);

				//Reset the dream happening
				if(elem.id == 'dreamsProba'){
					deleteStorage('probaDream');
				}
			}
			bars[i].onmouseleave = function(ev) {
				isMousedown = false;
			}
			bars[i].addEventListener('mousemove', moveBarValue);

			//Btn 0, 100 or reset
			let divParent = bars[i].parentNode;
			let btnControl = divParent.querySelectorAll('.bar-control');
			for(let btn of btnControl){
				btn.onclick = function(ev) {
					let parent = this.parentNode;
					let value = this.getAttribute('data-value');
					if(value == 'reset'){
						let valReset = parent.getAttribute('data-path');
						value = gObj(clone(window.database),valReset);
					}
					value+='%';
					let barHere = parent.querySelector('.bar-border');
					let barSub = barHere.querySelector('.bar-content');
					barSub.style.width = value;
					barSub.innerHTML = value;
					setting(barHere.id,value);

					//Reset the dream happening
					if(barHere.id == 'dreamsProba'){
						deleteStorage('probaDream');
					}
				};
			}
		}

		//Btn Elems
		function controlSelectElements(type){
			//Try to Turn Off and On again
			let btnOptionElemsList = getId('main-options').querySelectorAll('#list'+ucfirst(type)+' li span.icon');
			btnOptionElemsList.forEach(function(element){
				element.onclick = function(e) {
					let elemId = this.getAttribute('data-id');
					let typeId = this.getAttribute('data-type');
					let optionFeature = getId('list'+ucfirst(type)).getAttribute('data-feature');
					if(optionFeature === null)
						optionFeature = 'Disabled';

					if(elemId !== null){
						let elementsDisabled = setting(typeId+optionFeature);
						if(optionFeature == 'Disabled'){
							if(elementsDisabled === undefined)
								elementsDisabled = [];
							let find = elementsDisabled.indexOf(elemId);
							if(find != -1){
								elementsDisabled.splice(find,1);
								addClass(this,'icon-toggleOffR');
								removeClass(this,'icon-toggleOnR');
							}else{
								elementsDisabled.push(elemId);
								removeClass(this,'icon-toggleOffR');
								addClass(this,'icon-toggleOnR');
							}
						}else{
							if(elementsDisabled === undefined)
								elementsDisabled = {};
							let find = elementsDisabled[elemId];
							if(find == ''){
								delete elementsDisabled[elemId];
								addClass(this,'icon-toggleOffR');
								removeClass(this,'icon-toggleOnR');
							}else{
								elementsDisabled[elemId] = '';
								removeClass(this,'icon-toggleOffR');
								addClass(this,'icon-toggleOnR');
							}
						}
						
						setting(typeId+optionFeature,elementsDisabled);
						loadSelectElements(typeId);
					}
				};
			});

			//Manage the selects
			let selectOptionElemsList = getId('main-options').querySelectorAll('#list'+ucfirst(type)+' li select');
			selectOptionElemsList.forEach(function(element){
				element.onchange = function(e) {
					let elemId = this.getAttribute('data-id');
					let typeId = this.getAttribute('data-type');
					let optionFeature = getId('list'+ucfirst(type)).getAttribute('data-feature');
					if(optionFeature === null)
						optionFeature = 'Choose';

					if(elemId !== null){
						let elementsDisabled = setting(typeId+optionFeature);
						if(elementsDisabled === undefined)
							elementsDisabled = {};
						elementsDisabled[elemId] = this.value;
						removeClass(this,'icon-toggleOffR');
						addClass(this,'icon-toggleOnR');
						
						setting(typeId+optionFeature,elementsDisabled);
						loadSelectElements(typeId);
					}
				};
			});

			//Show/Hide the additionnal line
			let elemOptionsList = getId('main-options').querySelectorAll('#list'+ucfirst(type)+' li.elemOptions');
			elemOptionsList.forEach(function(element){
				let dataId = element.getAttribute('data-id');
				let findLiLinked = getId('main-options').querySelector('#list'+ucfirst(type)+' li.detailOptions[data-id="'+dataId+'"]');
				if(findLiLinked !== null){
					element.onclick = function(e) {
						toggleClass(findLiLinked,'hide');
					};
				}
			});
			let detailOptionsList = getId('main-options').querySelectorAll('#list'+ucfirst(type)+' li.detailOptions');
			detailOptionsList.forEach(function(element){
				element.onclick = function(e) {
					toggleClass(this,'hide');
				};
			});
		}

		//Cheats
		for(let cheat of getId('cheats').querySelectorAll('li')){
			cheat.onclick = function(){
				let cheatId = this.getAttribute('data-id');
				let list;
				switch(cheatId){
					case 'votes':
						let player = getCharacter('player');
						player.votes += window.database.difficulty[getStorage('difficulty')].price;
						player.save();
						showPopup(getTrad('optionmenu.optioncheatsactivated'),'div-success',2000);
						break;
					case 'traps':
						let actions = window.database.actions;
						let locaAction = {};
						for(let id in actions){
							let action = actions[id];
							if(locaAction[action.activity] === undefined)
								locaAction[action.activity] = [];
							locaAction[action.activity].push(id);
						}
						let villa = getStorage('villa');
						for(let loca in villa.locations){
							for(let actiId in villa.locations[loca].activities){
								if(locaAction[actiId] !== undefined){
									for(let actionId of locaAction[actiId]){
										villa.locations[loca].activities[actiId].trap.push(actionId);
									}
								}
							}
						}
						for(let loca in villa.bedrooms){
							for(let actiId in villa.bedrooms[loca].activities){
								if(locaAction[actiId] !== undefined){
									for(let actionId of locaAction[actiId]){
										villa.bedrooms[loca].activities[actiId].trap.push(actionId);
									}
								}
							}
						}
						setStorage('villa',villa);
						showPopup(getTrad('optionmenu.optioncheatsactivated'),'div-success',2000);
						break;
					case 'transform':
						list = archetypeDispo();
						if(list.length > 0){
							let options = ['<option value="">'+getTrad('optionmenu.optioncheatschoose')+'</option>'];
							for(let id of list){
								options.push('<option value="'+id+'">'+window.database.participants[id].name+'</option>');
							}
							let html = '<select id="selectCheat" data-id="'+cheatId+'">'+options.join('')+'</select>';
							showPopup(html);
							getId('popup').onclick = null;
						}
						break;
					case 'events':
						let eventsDisabled = setting('eventsDisabled');
						if(eventsDisabled === undefined)
							eventsDisabled = [];
						list = Object.keys(window.database.events);
						list = arrayDiff(list,eventsDisabled);
						if(list.length > 0){
							let options = ['<option value="">'+getTrad('optionmenu.optioncheatschoose')+'</option>'];
							for(let id of list){
								let infoEvent = window.database.events[id];
								if(infoEvent.when === undefined||infoEvent.when.length == 0)	//No Shuffle now
									continue;
								options.push('<option value="'+id+'">'+getTrad('events.'+id+'.name')+'</option>');
							}
							let html = '<select id="selectCheat" data-id="'+cheatId+'">'+options.join('')+'</select>';
							showPopup(html);
							getId('popup').onclick = null;
						}
						break;
					case 'dreams':
						let dreamsDisabled = setting('dreamsDisabled');
						if(dreamsDisabled === undefined)
							dreamsDisabled = [];
						list = Object.keys(window.database.morning.dreams);
						list = arrayDiff(list,dreamsDisabled);
						if(list.length > 0){
							let options = ['<option value="">'+getTrad('optionmenu.optioncheatschoose')+'</option>'];
							for(let id of list){
								options.push('<option value="'+id+'">'+getTrad('morning.dreams.'+id+'.title')+'</option>');
							}
							let html = '<select id="selectCheat" data-id="'+cheatId+'">'+options.join('')+'</select>';
							showPopup(html);
							getId('popup').onclick = null;
						}
						break;
				}

				//Popup
					let selectCheat = getId('selectCheat');
					if(selectCheat !== null){
						selectCheat.onchange = function(){
							let value = selectCheat.value;
							if(value != ''){
								let cheatId = selectCheat.getAttribute('data-id');
								switch(cheatId){
									case 'transform':
										let player = getCharacter('player');
										player.changeFace(value);
										break;
									case 'events':
										setStorage('nextEvents',value);
										break;
									case 'dreams':
										setStorage('nextDream',value);
										break;
								}
								showPopup(getTrad('optionmenu.optioncheatsactivated'),'div-success',2000);
								menuGame();
							}
						}
					}

				let player = getCharacter('player');
				if(player.stats.cheats === undefined){
					player.stats.cheats = {};
					player.stats.cheatsCurrent = {};
				}
				if(player.stats.cheats[cheatId] === undefined){
					player.stats.cheats[cheatId] = 0;
					player.stats.cheatsCurrent[cheatId] = 0;
				}
				player.stats.cheats[cheatId]++;
				player.stats.cheatsCurrent[cheatId]++;
				player.save();

				menuGame();
			}
		}
	}
	function profilePage(){

		let listProfils = getAllProfiles();
		let divShow = getId('listOfProfile');
		if(Object.keys(listProfils).length > 0){
			let htmlContent = '';
			let currentProfile = getProfileId();
			for(let profilId in listProfils){
				let profil = listProfils[profilId];

				let addClass = ['profilDisplay'];
				if(currentProfile == profilId)
					addClass.push('current');

				htmlContent += '<div class="'+addClass.join(' ')+'" data-id="'+profil.id+'"><b>'+profil.name+'</b> / <u>'+getTrad('profileManagement.created')+': '+profil.created_at+'</u> / <u>'+getTrad('profileManagement.played')+': '+profil.played+'</u><span data-id="'+profil.id+'" class="deleteProfil pointer icon icon-deleteChar"></span></div>';
			}
			divShow.innerHTML = htmlContent;

			let btnDeletes = document.getElementsByClassName('deleteProfil');
			for(let i=0;i < btnDeletes.length; i++){
				btnDeletes[i].onclick = function(e){
					e.stopPropagation();
					if(confirm(getTrad('profileManagement.deleteConfirm'))){

						let idToDelete = this.getAttribute('data-id');
						deleteProfile(idToDelete);

						if(getProfileId() == idToDelete)
							manageProfile();

						profilePage();
						showPage('main-profile','main-profile');

					}
				}
			}

			let btnChangeProfile = document.getElementsByClassName('profilDisplay');
			for(let i=0;i < btnChangeProfile.length; i++){
				btnChangeProfile[i].onclick = function(){
					let idToChange = this.getAttribute('data-id');
					changeProfile(idToChange);
					showPage('main-profile','main-menu');
				}
			}
		}else{
			divShow.innerHTML = '';
		}

		let from = getStorage('currentPage');
		showPage(from,'main-profile');

		getId('createProfile').onclick = function() {
			let nameProfile = getId('newNameProfile').value;
			nameProfile = nameProfile.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
			const regexClean = /[^a-zA-Z0-9_ -]/g;
			nameProfile = nameProfile.replaceAll(regexClean,'');
			if(nameProfile !== ''){
				manageProfile(nameProfile);
				location.reload();
			}
			return false;
		};
	}
	function savegamePage(){
		let saves = getStorage('saves');
		let contentElem = getId('main-savegame').querySelector('content');
		let indSave = 1;
		if(saves !== false && Object.keys(saves).length > 0){
			indSave = Object.keys(saves).length+1;
			let contentToInsert = [];
			for(let saveId in saves){
				let save = saves[saveId];
				if(save == null)
					continue;
				contentToInsert.push('<li data-id="'+saveId+'"><div class="saveInfo">'+save.name+' / '+(save.player?save.player:'')+'<br><i>'+save.date+'</i></div><div class="saveIcon"><span class="containerIcon"><span class="icon icon-savegame"></span></span><span class="containerIcon"><span class="icon icon-in"></span></span><span class="containerIcon"><span class="icon icon-trash"></span></span></div></li>');
				if('Save-'+indSave == save.name)
					indSave++;

			}
			contentElem.innerHTML = '<ul>'+contentToInsert.join('')+'</ul>';
		}else{
			contentElem.innerHTML = '<div class="centerContent">'+getTrad('mainmenu.nosave')+'</div>';
		}
		getId('nameDoSave').value = 'Save-'+indSave;

		function getSaveInfo(){
			let elemsSaved = {};
			for(let elem of elemsToSave){
				elemsSaved[elem] = getStorage(elem);
			}
			return JSON.stringify(elemsSaved);
		}

		//Control to create new save
		getId('btnDoSave').onclick = function(e) {
			let nameDoSave = getId('nameDoSave').value;

			let regexId = /[^a-zA-Z0-9_-]/;
			let nameId = nameDoSave.replace(regexId,'');

			let infoSave = getSaveInfo();

			let saves = getStorage('saves');
			if(saves == false)
				saves = {};

			let dateNow = ucfirst(getTrad('basic.day'))+': '+getStorage('dayNumber')+' / '+ucfirst(getTrad('basic.time.'+getStorage('timeDay')));
			let player = getCharacter('player');

			let newSave = {'name':nameDoSave,'date':dateNow,'player':player.firstname+' '+player.lastname,'content':infoSave};
			saves[nameId] = newSave;
			setStorage('saves',saves);

			let current = getStorage('currentPage');
			let previous = getStorage('backPage');
			if(previous == false || previous == current)
				previous = 'main-menu';
			showPage(current,previous);
		}

		getId('btnExport').onclick = function(e) {

			let dateNow = ucfirst(getTrad('basic.day'))+': '+getStorage('dayNumber')+' / '+ucfirst(getTrad('basic.time.'+getStorage('timeDay')));
			let player = getCharacter('player');
			let filename = 'wracked_'+player.firstname+'_'+player.lastname+'_'+dateNow+'.json';

			let tmpSave = document.createElement('a');
			tmpSave.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(getSaveInfo()));
			tmpSave.setAttribute('download', filename);

			tmpSave.style.display = 'none';
			document.body.appendChild(tmpSave);

			tmpSave.click();

			document.body.removeChild(tmpSave);
		}
		getId('btnImport').onchange = function(e) {
			if (this.length == 0) return;

			let file = this.files[0];
			let reader = new FileReader();
			reader.onload = (e) => {

				let jsonSave = JSON.parse(e.target.result);

				deleteStorage('stateGame');
				for(let elemId in jsonSave){
					if(jsonSave[elemId] === undefined||jsonSave[elemId] === false){
						deleteStorage(elemId);
					}else{
						setStorage(elemId,jsonSave[elemId]);
					}
				}
				continueGame();
				getId('btnImport').value = '';
			};
			reader.onerror = (e) => alert(e.target.error.name);

			reader.readAsText(file);
		}

		//Controle to load a save
		let btnsLoad = contentElem.querySelectorAll('li span.icon-in');
		btnsLoad.forEach(function(element){
			element.onclick = function(e) {

				clearPage();

				cleanStorage();

				let saveId = this.parentNode.parentNode.parentNode.getAttribute('data-id');
				let saves = getStorage('saves');
				let save = JSON.parse(saves[saveId].content);

				deleteStorage('stateGame');
				for(let elem of elemsToSave){
					if(save[elem] === undefined||save[elem] === false){
						deleteStorage(elem);
					}else{
						setStorage(elem,save[elem]);
					}
				}

				//Count how many load there was
				let player = getCharacter('player');
				player.set('stats.loadgame','++');
				
				continueGame();
				let current = getStorage('currentPage');
				showPage(current,'main-gamewindow');	
			}
		});

		//Controle to delete a save
		let btnsDelete = contentElem.querySelectorAll('li span.icon-trash');
		btnsDelete.forEach(function(element){
			element.onclick = function(e) {
				let saveId = this.parentNode.parentNode.parentNode.getAttribute('data-id');
				let saves = getStorage('saves');
				delete saves[saveId];

				setStorage('saves',saves);

				this.parentNode.parentNode.parentNode.parentNode.removeChild(this.parentNode.parentNode.parentNode);
			}
		});

		//Controle to overwrite a save
		let btnsOverwrite = contentElem.querySelectorAll('li span.icon-savegame');
		btnsOverwrite.forEach(function(element){
			element.onclick = function(e) {
				let saveId = this.parentNode.parentNode.parentNode.getAttribute('data-id');
				let saves = getStorage('saves');
				let save = saves[saveId];
				
				let elemsSaved = {};
				for(let elem of elemsToSave){
					elemsSaved[elem] = getStorage(elem);
				}

				let dateNow = new Date();
				dateNow = giveTimeString(dateNow,'formatFull');

				let player = getCharacter('player');

				save.date = dateNow;
				save.content = JSON.stringify(elemsSaved);
				save.player = player.firstname+' '+player.lastname;
				saves[saveId] = save;

				setStorage('saves',saves);

				let current = getStorage('currentPage');
				let previous = getStorage('backPage');
				if(previous == false || previous == current)
					previous = 'main-menu';
				showPage(current,previous);
			}
		});

		let from = getStorage('currentPage');
		showPage(from,'main-savegame');
	}
	function characterDetailsData(characterId){
		let character = getCharacter(characterId);
		let data = {};

		//Picture and First Info
			let picture = character.get('pict');
			if(character.get('profilePictsSet') !== undefined){
				let setPict = window.database.participants[character.get('archetype')].profilePicts[character.get('profilePictsSet')];
				if(characterId == 'player'){
					let pictureIndex = character.getStateProfile();
					picture = setPict[pictureIndex];
				}else{
					let nbStage = window.database.difficulty[getStorage('difficulty')].nbStage;
					if(character.get('stage') >= nbStage)
						picture = setPict[setPict.length-1];
					else
						picture = setPict[Math.ceil((setPict.length-1) * character.get('stage')/nbStage)];
				}
			}
			data.ident = characterId;
			data.picture = picture;
			data.name = character.get('firstname')+' '+character.get('lastname');
			data.other = character.get('age')+' '+getTrad('profile.yearsold')+', '+getTrad('profile.jobs.'+character.get('job'));

		//Other Info
			let passions = [];
			for(let passion of character.get('passions')){
				passions.push(getTrad('profile.passions.'+passion));
			}
			if(character.get('passionsTransformed') !== undefined){
				for(let passion of character.get('passionsTransformed')){
					passions.push('<pink>'+getTrad('profile.passions.'+passion)+'</pink>');
				}
			}

			let iqHere = character.get('iq');
			let sexualpref = getTrad('profile.sexualpref.'+character.get('sexualpref'));
			if(character.get('sexualpref') == 'heterosexual'){
				sexualpref += ' ('+ucfirst(getTrad('basic.gender.'+(this.gender == 'man'?'women':'men')))+')';
			}else if(character.get('sexualpref') == 'homosexual'){
				sexualpref += ' ('+ucfirst(getTrad('basic.gender.'+(this.gender == 'man'?'men':'women')))+')';
			}
			if(characterId == 'player'){
				iqHere = Math.floor(character.get('iq') - ((character.get('iq') - 70) * character.get('bimbo') / 100));
			}
			let infoFill = {
				"gender":ucfirst(getTrad('basic.gender.'+character.get('gender'))),
				"iq":iqHere,
				"birthday":character.get('birthday'),
				"astro":getTrad('astrologicalsign.'+character.get('astrologicSign')),
				"sexualpref":sexualpref,
				"city":character.get('city'),
				"passions":passions.join(', '),
			};
			data.infoFill = infoFill;

		//Album			
			data.album = character.album;

		//Testimonial
			data.testimonial = character.get('testimonial');

		return data;
	}
	function characterDetailsShow(dataToDisplay){
		//Picture and First Info
			getId('profilePictureImg').setAttribute('src',dataToDisplay.picture);
			getId('profileName').innerHTML = dataToDisplay.name;
			getId('profileNameOther').innerHTML = dataToDisplay.other;

		//Other Info
			let infoTab = [];
			for(let infoId in dataToDisplay.infoFill){
				infoTab.push(
					'<div class="partTitle">'+getTrad('profile.title.'+infoId)+'</div>'+
					'<div class="partContent">'+dataToDisplay.infoFill[infoId]+'</div>'
				);
			}

			getId('profileInfo').innerHTML = '<li>'+infoTab.join('</li><li>')+'</li>';

		//Album
			getId('titleAlbum').innerHTML = (dataToDisplay.ident == 'player'?getTrad('profile.title.myalbum'):getTrad('profile.title.albums',getCharacter(dataToDisplay.ident)));
			getId('profileAlbumSection').innerHTML = dataToDisplay.album;

		//Testimonial
			getId('profileTestimonial').innerHTML = dataToDisplay.testimonial;
	}
	function characterDetails(characterId){
		
		if(characterId !== undefined)
			setStorage('profileChar',characterId);
		else
			characterId = getStorage('profileChar');

		let character = getCharacter(characterId);

		let dataToDisplay = character.get('previousProfile')[character.get('previousProfile').length-1];
		characterDetailsShow(dataToDisplay);

		activatePageTabs('profileChar');
		let btnSwitch = getId('profileChar').querySelectorAll('.subPageTitle div');
		btnSwitch[0].click();

		addClass(getId('profileHistoPrev'),'hide');
		addClass(getId('profileHistoNext'),'hide');
		if(setting('highlightchange') && character.get('previousProfile').length > 1){
			removeClass(getId('profileHistoPrev'),'hide');
			removeClass(getId('profileHisto'),'hide');
			getId('profileHistoPrev').setAttribute('data-index',character.get('previousProfile').length-2);
			addClass(getId('profileHistoNext'),'hide');

			getId('profileHistoPrev').onclick = function(e){
				let character = getCharacter(getStorage('profileChar'));
				let index = this.getAttribute('data-index');
				characterDetailsShow(character.get('previousProfile')[index]);
				if(index > 0){
					getId('profileHistoPrev').setAttribute('data-index',parseInt(index)-1);
				}else{
					addClass(getId('profileHistoPrev'),'hide');
				}

				removeClass(getId('profileHistoNext'),'hide');
				getId('profileHistoNext').setAttribute('data-index',parseInt(index)+1);
			};
			getId('profileHistoNext').onclick = function(e){
				let character = getCharacter(getStorage('profileChar'));
				let index = this.getAttribute('data-index');
				removeClass(getId('profileHistoPrev'),'hide');
				if(index == character.get('previousProfile').length - 1){
					characterDetailsShow(character.get('previousProfile')[index]);
					addClass(getId('profileHistoNext'),'hide');
					getId('profileHistoPrev').setAttribute('data-index',parseInt(index)-1);
				}else{
					characterDetailsShow(character.get('previousProfile')[index]);
					getId('profileHistoPrev').setAttribute('data-index',parseInt(index)-1);
					getId('profileHistoNext').setAttribute('data-index',parseInt(index)+1);
				}
			};
		}

		//Player Char react to the bullshit on the profile
		if(characterId == 'player' && (character.info === undefined||character.info.firstProfil === undefined)){

			let contentDisplay = [];
			contentDisplay.push(giveDiscussText({"who":"player","pictType":"pict"},getTrad('profile.firstreact.player1',{'player':character})));
			contentDisplay.push(giveDiscussText({"who":"ia","pictType":"laughing"},getTrad('profile.firstreact.ai1',{'player':character})));
			contentDisplay.push(giveDiscussText({"who":"player","pictType":"pict"},getTrad('profile.firstreact.player2',{'player':character})));
			contentDisplay.push(giveDiscussText({"who":"ia"},getTrad('profile.firstreact.ai2',{'player':character})));
			contentDisplay.push(giveDiscussText({"who":"player","pictType":"pict"},getTrad('profile.firstreact.player3',{'player':character})));
			contentDisplay.push(giveDiscussText({"who":"ia","pictType":"upset"},getTrad('profile.firstreact.ai3',{'player':character})));
			showPopup(contentDisplay.join(''),'firstTimeProfile');

			let info = character.info;
			if(info === undefined)
				info = {};
			info.firstProfil = true;
			character.set('info',info);
		}

		let from = getStorage('currentPage');
		showPage(from,'profileChar');
		window.scrollTo(0, 0);
	}
	function characterList(){

		let characters = getStorage('characters');
		let progressnumber = setting('progressnumber');
		let nbStage = window.database.difficulty[getStorage('difficulty')].nbStage;

		let contentDisplay = getId('housemateList');
		let contentToInsert = [];
		for(charId in characters){
			let character = getCharacter(charId);

			let barDisplay = '';
			if(progressnumber === true && charId !== 'player'){
				let ratio = Math.round(character.stage * 100 / nbStage);
				barDisplay = '<div class="barSuccess barMeter">'+
								'<div class="barText"><span class="barTextSpan">'+getTrad('basic.progress')+': '+character.stage+'/'+nbStage+'</span></div>'+
								'<span class="barBar" style="width: '+ratio+'%;"></span>'+
							'</div>';
			}

			let html = '<li data-id="'+charId+'">'+ 
							'<div class="smallDescPict"><img src="'+character.get('pict')+'"></div>'+
							barDisplay+
							'<div class="smallDescName">'+character.get('firstname')+' '+character.get('lastname')+'</div>'+
							'<div class="smallDescOther">'+
								character.get('age')+' '+getTrad('profile.yearsold')+'<br>'+
								getTrad('profile.jobs.'+character.get('job'))+
							'</div>'+
						'</li>';
			contentToInsert.push(html);
		}
		contentDisplay.innerHTML = contentToInsert.join('');

		let player = getCharacter('player');
		getId('charListIA').innerHTML = discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,getTrad('profile.iadesc',player));

		let imgsDesc = getId('listOfCharacters').querySelectorAll('content .smallDescPict img');
		imgsDesc.forEach(function(element){
			element.onclick = function(e) {
				let idChar = this.parentNode.parentNode.getAttribute('data-id');
				characterDetails(idChar);
			}
		});

		let from = getStorage('currentPage');
		showPage(from,'listOfCharacters');
	}
	function achievementPage(){
		let from = getStorage('currentPage');
		showPage(from,'main-achievement');
		//TODO
	}
	function showStore(){

		let player = getCharacter('player');
		let html = '<div class="centerContent">'+getTrad('basic.youhavexvote',{'nbvote':player.get('votes')})+'</div>';

		let buyable = clone(window.database.buyable);
		let price = window.database.difficulty[getStorage('difficulty')].price;

		removeClass(getId('storeMain'),'hide');
		addClass(getId('storeDetail'),'hide');

		let sortObjects = {};
		let craveItem = {};
		for(let id in buyable){
			let item = buyable[id];
			if(sortObjects[item.type] === undefined)
				sortObjects[item.type] = {};

			if(item.hide !== undefined && item.hide){
				if(id == 'boobsrejuv'){
					let sizeBoobs = clone(window.database.boobsSize);
					let sizeBaseArchetype = window.database.participants[player.archetype].sizeBoobs;
					let enlargementLvl = (player.inventory.boobsenlargement !== undefined ? player.inventory.boobsenlargement.stage : 0);
					if(sizeBoobs.indexOf(sizeBaseArchetype)+enlargementLvl <= sizeBoobs.indexOf(player.sizeBoobs)){
						continue;
					}
				}else{
					continue;
				}
			}

			//Sold out
			if(item.stage !== undefined){
				let stage = (player.get('inventory')[id] !== undefined ? player.get('inventory')[id].stage + 1 : 1);
				if(item['pictStage'+stage] === undefined)
					item.soldout = 'pictStage'+(stage-1);
			}

			sortObjects[item.type][id] = item;

			if(item.crave !== undefined && item.soldout === undefined){
				craveItem[item.crave] = id;
			}
		}

		//Crave, force to buy
		removeClass(getId('storeMain').querySelector('.backBtn'),'hide');
		let craveItemId = null;
		for(let crave in craveItem){
			if(parseInt(player.get(crave)) >= window.database.difficulty[getStorage('difficulty')].craveCounter){
				craveItemId = craveItem[crave];
				let newObjects = {};
				for(let type in sortObjects){
					newObjects[type] = [];
					for(let id in sortObjects){
						newObjects[type].push(buyable[craveItemId]);
					}
				}
				sortObjects = newObjects;

				if(price < player.get('votes')){
					addClass(getId('storeMain').querySelector('.backBtn'),'hide');
				}
			}
		}

		for(let type in sortObjects){
			html += '<div class="storeSection"><h3>'+getTrad('buyabletype.'+type)+'</h3><ul class="inventory">';
			for(let id in sortObjects[type]){

				let disabled = (price > player.get('votes') ? 'disabled="disabled"' : '');
				let titleHere = getTrad('basic.buynow');
				let textHere = getTrad('basic.buyitforxvote',{'price':price});
				
				if(craveItemId !== null)
					id = craveItemId;

				let item = buyable[id];

				let pict = item.pict;
				if(item.soldout !== undefined){
					pict = item[item.soldout];
					disabled = 'disabled="disabled"';
					textHere = getTrad('basic.soldout');
				}else if(item.pictStage1 !== undefined){
					let stage = (player.get('inventory')[id] !== undefined ? player.get('inventory')[id].stage + 1 : 1);
					pict = item['pictStage'+stage];
				}

				html += '<li '+disabled+' class="" data-id="'+id+'" title="'+getTrad('basic.lookatit')+'">'+
									'<span class="imgInventory"><img src="'+pict+'"></span>'+
									'<div class="imgName">'+getTrad('buyable.'+id+'.name')+'</div>'+
									'<div class="buying" '+disabled+' data-id="'+id+'" title="'+titleHere+'">'+textHere+'</div>'+
							'</li>';
			}
			html += '</ul></div>';
		}

		getId('storeMain').querySelector('content').innerHTML = html;

		getId('btnStoreBack').onclick = function(){
			removeClass(getId('storeMain'),'hide');
			addClass(getId('storeDetail'),'hide');
		}

		//Btn Buy
		let btnsBuy = getId('storeMain').querySelectorAll('content .buying:not([disabled]');
		btnsBuy.forEach(function(btn){
			btn.onclick = function(e) {
				e.stopPropagation();
				let id = this.getAttribute('data-id');

				getCharacter('player').buyItem(id);
				saveStateGame();

				menuGame();
				showStore();

				showBuyPopup(id);
			};
		});

		//Btn Detail
		let invObject = getId('storeMain').querySelectorAll('content li');
		invObject.forEach(function(btn){
			btn.onclick = function(e) {
				let id = this.getAttribute('data-id');

				let player = getCharacter('player');
				let buyable = clone(window.database.buyable);
				let price = window.database.difficulty[getStorage('difficulty')].price;
				let isBuyable = (price <= player.get('votes'));

				let item = buyable[id];
				let pict = item.pict;
				if(item.pictStage1 !== undefined){
					let stage = (player.get('inventory')[id] !== undefined ? player.get('inventory')[id].stage + 1 : 1);
					if(item['pictStage'+stage] === undefined){
						pict = item['pictStage'+(stage-1)];
						isBuyable = false;
					}else{
						pict = item['pictStage'+stage];
					}
				}

				let html = [];
				html.push('<h1>'+getTrad('buyable.'+id+'.name')+'</h1>')
				html.push('<div class="centerContent"><img src="'+pict+'"></div>');
				html.push('<div class="centerContent">'+getTrad('buyable.'+id+'.desc')+'</div>');

				if(isBuyable){
					html.push('<div class="centerContent"><div class="btn btn-success" data-id="'+id+'">'+getTrad('basic.buyitforxvote',{'price':price})+'</div></div>');
				}
				
				getId('storeDetail').querySelector('content').innerHTML = html.join('');
				addClass(getId('storeMain'),'hide');
				removeClass(getId('storeDetail'),'hide');

				let modItemBtn = getId('storeDetail').querySelector('.btn-success');
				if(modItemBtn !== undefined && modItemBtn !== null){
					modItemBtn.onclick = function(){
						let id = this.getAttribute('data-id');

						getCharacter('player').buyItem(id);
						saveStateGame();

						menuGame();
						showStore();

						showBuyPopup(id);
					}
				}
			};
		});

		let from = getStorage('currentPage');
		showPage(from,'storePage');
	}
	function showInventory(){

		function getInventoryInfo(id){

			let info = {'name':'','pict':'','desc':''};

			let actions = clone(window.database.actions);
			let buyable = clone(window.database.buyable);

			let inventory = getCharacter('player').get('inventory');
			let item = inventory[id];
			if(actions[id] !== undefined){
				info.pict = (item.modified ? actions[id].pictmod : actions[id].pictbase);
				info.name = getTrad('actions.'+id+'.name');
				info.type = 'actions';

				if(item.modified){
					info.desc = getTrad('actions.'+id+'.modified');
				}else{
					info.desc = getTrad('actions.'+id+'.desc');
					if(inventory[item.object] !== undefined && inventory[item.object].quantity > 0){
						info.modifiable = {'id':item.object};
					}
				}
			}else if(buyable[id] !== undefined){
				if(item.notinventory !== undefined && item.notinventory)
					return false;

				info.pict = (item.stage !== undefined ? buyable[id]['pictStage'+item.stage] : buyable[id].pict);
				info.name = getTrad('buyable.'+id+'.name');
				info.type = 'buyable';
				info.desc = getTrad('buyable.'+id+'.desc');
			}

			info.nameDisplay = info.name;
			if(item.quantity !== undefined){
				info.quantity = item.quantity;
				info.nameDisplay += ' x '+item.quantity;
			}

			return info;
		}

		removeClass(getId('inventoryMain'),'hide');
		addClass(getId('inventoryDetail'),'hide');

		let player = getCharacter('player');
		let inventory = player.get('inventory');

		let stuff = [];
		let html = '<div class="centerContent">'+getTrad('basic.nothinghere')+'</div>';
		if(Object.keys(inventory).length > 0){
			for(let i in inventory){
				let info = getInventoryInfo(i);

				if(info !== false){
					stuff.push('<li class="" data-id="'+i+'" data-type="'+info.type+'">'+
									'<span class="imgInventory"><img src="'+info.pict+'"></span>'+
									'<div class="imgName">'+info.nameDisplay+'</div>'+
							'</li>');
				}
			}
			html = '<ul class="inventory">'+stuff.join('')+'</ul>';
		}

		getId('inventoryMain').querySelector('content').innerHTML = html;
		getId('btnInventoryBack').onclick = function(){
			removeClass(getId('inventoryMain'),'hide');
			addClass(getId('inventoryDetail'),'hide');
		}

		//Btn Object details
		let invObject = getId('inventoryMain').querySelectorAll('content li');
		invObject.forEach(function(btn){
			btn.onclick = function(e) {
				let id = this.getAttribute('data-id');
				let type = this.getAttribute('data-type');

				let info = getInventoryInfo(id);

				let html = [];
				html.push('<h1>'+info.name+'</h1>')
				html.push('<div class="centerContent"><img src="'+info.pict+'"></div>');
				html.push('<div class="centerContent">'+info.desc+'</div>');

				if(info.modifiable !== undefined){
					html.push('<div class="centerContent "><div class="useBtn" data-id="'+id+'">'+
									'<img src="'+window.database.buyable[info.modifiable.id].pict+'">'+
									'<span>'+getTrad('basic.useitem',{'name':getTrad('buyable.'+info.modifiable.id+'.name')})+'</span>'+
								'</div></div>');
				}
				
				getId('inventoryDetail').querySelector('content').innerHTML = html.join('');
				addClass(getId('inventoryMain'),'hide');
				removeClass(getId('inventoryDetail'),'hide');

				let modItemBtn = getId('inventoryDetail').querySelector('.useBtn');
				if(modItemBtn !== undefined && modItemBtn !== null){
					modItemBtn.onclick = function(){				//Modify the item
						let id = this.getAttribute('data-id');

						getCharacter('player').modItem(id);
						saveStateGame();

						showInventory();
					}
				}
			};
		});

		let from = getStorage('currentPage');
		showPage(from,'inventoryPage');
	}

/********** NEW GAME *******/
	function newGamePage(){

		//Reset the starting pages
		let allPages = getId('main-newGame').querySelectorAll('div.pageContent');
		for(let page of allPages){
			addClass(page,'hide');
		}
		removeClass(allPages[0],'hide');

		let from = getStorage('currentPage');
		showPage(from,'main-newGame');

		//Reset the game
		cleanStorage();
		setStorage('dayNumber',1);

		getId('skipPrologue').setAttribute('disabled','disabled');
		getId('startNewGame').querySelector('.changeStep').setAttribute('disabled','disabled');
		let errorsField = getId('startNewGame').querySelectorAll('.newgameError');
		for(let elem of errorsField){
			elem.innerHTML = '';
		}

		//Difficulty
			let difficultyData = window.database.difficulty;
			let contentToInsert = [];
			for(let difficulty in difficultyData){
				let classAdd = '';
				if(contentToInsert.length == 0)
					classAdd = 'highlight';
				contentToInsert.push('<div class="divDiff '+classAdd+'" data-id="'+difficulty+'"><div class="titleDiff">'+getTrad('newgame.difficulty.'+difficulty)+'</div><div class="descDiff">'+getTrad('newgame.difficulty.'+difficulty+'desc')+'</div></div>')
			}
			getId('difficultyField').innerHTML = contentToInsert.join('');
			for(let divDiff of getId('difficultyField').querySelectorAll('.divDiff')){
				divDiff.onclick = function(){
					for(let tmp of getId('difficultyField').querySelectorAll('.divDiff')){
						removeClass(tmp,'selected');
						removeClass(tmp,'highlight');
					}
					addClass(this,'selected');
				}
			}

		//Gender
			function checkPerkImg(){
				let genderId = (getId('genderField').querySelector('.selected') !== null ? getId('genderField').querySelector('.selected').getAttribute('data-id') : getId('genderField').querySelector('.highlight').getAttribute('data-id'));
				if(genderId == 'man'){
					let perkMan = getId('perksField').querySelectorAll('.perkMan');
					for(let pict of perkMan){
						removeClass(pict,'hide');
					}
					let perkWoman = getId('perksField').querySelectorAll('.perkWoman');
					for(let pict of perkWoman){
						addClass(pict,'hide');
					}
				}else{
					let perkMan = getId('perksField').querySelectorAll('.perkMan');
					for(let pict of perkMan){
						addClass(pict,'hide');
					}
					let perkWoman = getId('perksField').querySelectorAll('.perkWoman');
					for(let pict of perkWoman){
						removeClass(pict,'hide');
					}
				}
			}
			let genders = window.database.characterInfo.gender;
			contentToInsert = [];
			for(let genderId in genders){
				contentToInsert.push('<img src="'+genders[genderId].pict+'" data-id="'+genderId+'" title="'+ucfirst(getTrad('basic.gender.'+genderId))+'">');
			}
			getId('genderField').innerHTML = contentToInsert.join('');
			for(let divDiff of getId('genderField').querySelectorAll('img')){
				divDiff.onclick = function(){
					for(let tmp of getId('genderField').querySelectorAll('img')){
						removeClass(tmp,'highlight');
					}
					if(haveClass(this,'selected'))
						toggleClass(this,'selected');
					else{
						for(let tmp of getId('genderField').querySelectorAll('img')){
							removeClass(tmp,'selected');
						}
						toggleClass(this,'selected');
					}
					if(haveClass(this,'selected')){
						checkPerkImg();
					}
					sliderHide();
				}
			}

		//Hair Color
			let hairColors = [];
			let participantsData = window.database.participants;
			let archetypeAvailables = archetypeDispo();
			for(let participantId of archetypeAvailables){
				let participantInfo = participantsData[participantId];
				hairColors.push(participantInfo.hairColor);
			}
			hairColors = arrayUnique(hairColors);
			contentToInsert = [];
			for(let hairColor in window.database.characterInfo.hairColor){
				let hairColorInfo = window.database.characterInfo.hairColor[hairColor];
				let classHere = '';
				if(hairColors.indexOf(hairColor) === -1)
					classHere = 'disabled';
				contentToInsert.push('<img class="'+classHere+'" src="'+hairColorInfo.pict+'" data-id="'+hairColor+'" title="'+ucfirst(getTrad('basic.color.'+hairColor))+'">');
			}
			getId('haircolorField').innerHTML = contentToInsert.join('');
			for(let divDiff of getId('haircolorField').querySelectorAll('img')){
				divDiff.onclick = function(){
					for(let tmp of getId('haircolorField').querySelectorAll('img')){
						removeClass(tmp,'highlight');
					}
					if(!haveClass(this,'disabled')){
						if(haveClass(this,'selected'))
							toggleClass(this,'selected');
						else{
							for(let tmp of getId('haircolorField').querySelectorAll('img')){
								removeClass(tmp,'selected');
							}
							toggleClass(this,'selected');
						}
						sliderHide();
					}
				}
			}

		//Faces
			function sliderHide(){
				let allPictNewGame = getId('slidersFace').querySelectorAll('img');
				let genderChoice = getId('genderField').querySelector('.selected');
				if(genderChoice !== null)
					genderChoice = genderChoice.getAttribute('data-id');
				let haircolorChoice = getId('haircolorField').querySelector('.selected');
				if(haircolorChoice !== null)
					haircolorChoice = haircolorChoice.getAttribute('data-id');

				for(let pict of allPictNewGame){
					removeClass(pict,'hide');
					if(genderChoice !== null && pict.getAttribute('data-gender') !== genderChoice)
						addClass(pict,'hide');
					if(haircolorChoice !== null && pict.getAttribute('data-hair') !== haircolorChoice)
						addClass(pict,'hide');
				}
				sliderClick();
			}
			function sliderClick(index){
				let allPictNewGame = getId('slidersFace').querySelectorAll('img');
				if(allPictNewGame.length > 0){
					let listAvailable = [];
					for(let pict of allPictNewGame){
						emptyClass(pict,['selected','next','next2','previous','previous2']);
						if(haveClass(pict,'hide'))
							continue;
						listAvailable.push(parseInt(pict.getAttribute('data-index')));
						pict.onclick = function(){
							let indexHere = this.getAttribute('data-index');
							sliderClick(parseInt(indexHere));
						};
					}

					let findIndex = 0;
					if(index !== undefined)
						findIndex = listAvailable.indexOf(index);
					let next = listAvailable[(findIndex + 1 > listAvailable.length-1 ? (findIndex + 1) - listAvailable.length : findIndex + 1)];
					let next2 = listAvailable[(findIndex + 2 > listAvailable.length-1 ? (findIndex + 2) - listAvailable.length : findIndex + 2)];
					let previous = listAvailable[(findIndex-1 < 0  ? listAvailable.length + findIndex-1 : findIndex-1)];
					let previous2 = listAvailable[(findIndex-2 < 0 ? listAvailable.length + findIndex-2 : findIndex-2)];

					addClass(allPictNewGame[listAvailable[findIndex]],'selected');
					if(allPictNewGame[next] !== undefined && listAvailable.length > 1)
						addClass(allPictNewGame[next],'next');
					if(allPictNewGame[next2] !== undefined && listAvailable.length > 3)
						addClass(allPictNewGame[next2],'next2');
					if(allPictNewGame[previous] !== undefined && listAvailable.length > 2)
						addClass(allPictNewGame[previous],'previous');
					if(allPictNewGame[previous2] !== undefined && listAvailable.length > 4)
						addClass(allPictNewGame[previous2],'previous2');
					getId('slidersFaceContainer').querySelector('.icon-goon').onclick = function(){sliderClick(next);};
					getId('slidersFaceContainer').querySelector('.icon-goback').onclick = function(){sliderClick(previous);};

					//Highlight
					if(getId('haircolorField').querySelector('.selected') === null){
						let infoHairChoose = allPictNewGame[listAvailable[findIndex]].getAttribute('data-hair');
						let pictHair = getId('haircolorField').querySelectorAll('img');
						for(let pict of pictHair){
							removeClass(pict,'highlight');
							if(pict.getAttribute('data-id') == infoHairChoose){
								addClass(pict,'highlight');
							}
						}
					}
					if(getId('genderField').querySelector('.selected') === null){
						let infoGenderChoose = allPictNewGame[listAvailable[findIndex]].getAttribute('data-gender');
						let pictGender = getId('genderField').querySelectorAll('img');
						for(let pict of pictGender){
							removeClass(pict,'highlight');
							if(pict.getAttribute('data-id') == infoGenderChoose){
								addClass(pict,'highlight');
							}
						}
					}

					checkPerkImg();
				}
			}
			let faceList = [];
			for(let modelId of archetypeAvailables){
				let model = window.database.participants[modelId];
				faceList.push('<img src="'+model.picts.base+'" data-id="'+modelId+'" data-index="'+faceList.length+'" data-hair="'+model.hairColor+'" data-gender="woman" data-type="'+model.typeBody+'">');
			}
			for(let hairColor in window.database.creation.menProfile){
				if(hairColors.indexOf(hairColor) === -1)
					continue;
				for(let modelId in window.database.creation.menProfile[hairColor]){
					let imgPict = window.database.creation.menProfile[hairColor][modelId];
					faceList.push('<img src="'+imgPict+'" data-id="man-'+hairColor+'-'+modelId+'" data-index="'+faceList.length+'" data-hair="'+hairColor+'" data-gender="man" data-type="man">');
				}
			}
			getId('slidersFace').innerHTML = faceList.join('');
			sliderClick();

		//Perks
			getId('perksFieldName').innerHTML = getTrad('newgame.perks',{'nbperks':window.database.creation.perksMax});
			let perksAvailable = window.database.creation.perksAvailable;
			contentToInsert = [];
			for(let perk of perksAvailable){
				let infoPerk = window.database.perks[perk];
				contentToInsert.push('<div class="perks" data-id="'+perk+'">'+
										'<div class="perkPict">'+
										(infoPerk.pictman !== undefined ? '<img class="perkMan hide" src="'+infoPerk.pictman+'"><img class="perkWoman" src="'+infoPerk.pictwoman+'">' : '<img src="'+infoPerk.pict+'">' )+
										'</div>'+
										'<div class="perkText">'+
											'<b>'+getTrad('perks.'+perk+'.name')+'</b><hr>'+getTrad('perks.'+perk+'.descstart')+
											(setting('perksinfluence') !== undefined && setting('perksinfluence') ? '<br><i>'+getTrad('perks.'+perk+'.effect')+'</i>' : '')+
										'</div>'+
									'</div>');
			}
			getId('perksField').innerHTML = contentToInsert.join('');
			let checkboxPerks = getId('perksField').querySelectorAll('.perks');
			checkboxPerks.forEach(function(element){
				element.onclick = function(e){
					if(!haveClass(this,'disabled')){
						toggleClass(this,'selected');
						let checkboxPerks = getId('perksField').querySelectorAll('.perks');
						let nbChecked = 0;
						for(let elem of checkboxPerks){
							removeClass(elem,'disabled');
							if(haveClass(elem,'selected'))
								nbChecked++;
						}
						getId('skipPrologue').setAttribute('disabled','disabled');
						getId('startNewGame').querySelector('.changeStep').setAttribute('disabled','disabled');
						if(nbChecked >= window.database.creation.perksMax){
							for(let elem of checkboxPerks){
								if(!haveClass(elem,'selected')){
									addClass(elem,'disabled');
								}
							}
							if(getId('slidersFace').querySelector('.selected') !== null){
								getId('skipPrologue').removeAttribute('disabled');
								getId('startNewGame').querySelector('.changeStep').removeAttribute('disabled');
							}
						}
					}
				};
			});

		//Additional Control
			getId('refreshName').onclick = function(){
				let currentGender = getId('genderField').querySelector('.selected');
				if(currentGender == null)
					currentGender = getId('genderField').querySelector('.highlight');
				currentGender = currentGender.getAttribute('data-id');

				let namesList = null;
				let value = null;
				if(currentGender == 'man')
					namesList = clone(window.database.characterInfo.maleNames);
				else
					namesList = clone(window.database.characterInfo.femaleNames);
				value = pickRandom(namesList);
				getId('firstnameField').value = value;

				namesList = clone(window.database.characterInfo.lastNames);
				value = pickRandom(namesList);
				getId('lastnameField').value = value;
			}

		for(let elem of getId('main-newGame').querySelectorAll('.finishCreation')){
			elem.onclick = function(){
				startGamePage();
			}
		}
		getId('skipPrologue').onclick = function(){
			try{
				initNewGame();
				startGamePage();			
			}catch(error){
				console.log('error6',error);
				showError(error);
				let from = getStorage('currentPage');
				showPage(from,'main-menu');
			}
		}
	}

	function btnStepControl(elem){

		let errors = [];
		let previousPage = elem.getAttribute('data-current');
		let currentPage = elem.getAttribute('data-other');
		switch(previousPage){
			case 'startNewGame':
				//Verify data
				if(getId('haircolorField').value == ''){
					errors.push(getTrad('errors.newgamehaircolor'));
					break;
				}

				//Check if the hair color + gender have a participant available
				if(getId('genderField').value == 'man'){
					//TODO
				}

				initNewGame();

				//Build the Pict Prologue Page
				let player = getCharacter('player');
				if(player.wasMan)
					getId('facePlayer').src = player.get('pictMan');
				else
					getId('facePlayer').src = player.get('pict');

				let villa = getStorage('villa');
				getId('villaPict1').src = villa.advertsPict[0];
				getId('villaPict2').src = villa.advertsPict[1];
				getId('villaPict3').src = villa.advertsPict[2];
				getId('villaPict4').src = villa.advertsPict[0];
				getId('villaPict5').src = villa.advertsPict[2];
				getId('villaPict6').src = villa.bedrooms.player.pict;
				getId('villaPictLivingroom').src = villa.locations.livingroom.pict;
				getId('villaPictBedroom').src = villa.bedrooms.player.pict;

				for(let elem of getId('main-newGame').querySelectorAll('.villaBtnFinalWoman')){
					if(!player.wasMan){
						removeClass(elem,'hide');
					}else{
						addClass(elem,'hide');
					}
				}
				for(let elem of getId('main-newGame').querySelectorAll('.villaBtnFinalMan')){
					if(player.wasMan){
						removeClass(elem,'hide');
					}else{
						addClass(elem,'hide');
					}
				}

				if(player.wasMan){
					let tmpCheck = player.sizeBoobs.split('_');
					let pictsBoobsList = player.picturesTypes('topCloth');
					let pictsBottomsList = player.picturesTypes('bottomCloth');

					let transfo = [];
					transfo.push(getTransfo(player.starting.face,window.database.participants[player.archetype].picts.base));
					transfo.push(getTransfo(player.starting.torsoPict,pictsBoobsList[pictsBoobsList.length -1]));
					transfo.push(getTransfo(player.starting.bottomPict,pictsBottomsList[pictsBottomsList.length -1]));
					getId('villaTransformation').innerHTML = transfo.join('');
				}

				//Build the Text Prologue Page
				let elemsToChange = {
					'firstNamePlayer': (player.wasMan ? player.get('firstnameMan') : player.get('firstname')),
					'lastNamePlayer':player.get('lastname'),
					'jobPlayer':getTrad('jobs.'+player.trueJob+'.full'),
					'formalPlayer': (player.wasMan ? player.getFormal('man') : player.getFormal()),
					'nbParticipantText':getTrad('newgame.nbparticipantstext')
				};
				for(let elemId in elemsToChange){
					let list = getId('main-newGame').querySelectorAll('.'+elemId);
					for(let e of list){
						e.innerHTML = elemsToChange[elemId];
					}
				}

				getId('villaAIPresentation').innerHTML = discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,getTrad('newgame.page4.aipresentation',player));
				getId('villaAIPresentation2').innerHTML = discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,getTrad('newgame.page4.aipresentation2',player));
				getId('villaAIPresentation3').innerHTML = discuss(pickRandom(clone(window.database.ia.laughing)),window.database.ia.iaName,getTrad('newgame.page4.aipresentation3',player));
				getId('villaAIPresentation4').innerHTML = discuss(pickRandom(clone(window.database.ia.laughing)),window.database.ia.iaName,getTrad('newgame.page5.aipresentation',player));
				getId('villaAIPresentation5').innerHTML = discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,getTrad('newgame.page5.aipresentation2',player));
				getId('villaRealisation1').innerHTML = discuss(player.get('pict'),player.getName(),getTrad('newgame.page5.realization1',player));
				getId('villaAIPresentation6').innerHTML = discuss(pickRandom(clone(window.database.ia.laughing)),window.database.ia.iaName,getTrad('newgame.page5.aipresentation3',player));
				getId('villaRealisation2').innerHTML = discuss(player.get('pict'),player.getName(),getTrad('newgame.page5.realization2',player));
				getId('villaAIPresentation7').innerHTML = discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,getTrad('newgame.page5.aipresentation4',player));
				getId('villaRealisation3').innerHTML = discuss(player.get('pict'),player.getName(),getTrad('newgame.page5.realization3',player));
				getId('villaAIPresentation8').innerHTML = discuss(pickRandom(clone(window.database.ia.laughing)),window.database.ia.iaName,getTrad('newgame.page5.aipresentation5',player));
				getId('villaRealisation4').innerHTML = discuss(player.get('pict'),player.getName(),getTrad('newgame.page5.realization4',player));

				getId('villaAIPresentation9m').innerHTML = discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,getTrad('newgame.page6.aipresentationm',player));
				getId('villaAIPresentation9w').innerHTML = discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,getTrad('newgame.page6.aipresentationw',player));

				let presentationAll = [];
				presentationAll.push(discuss(pickRandom(clone(window.database.ia.laughing)),window.database.ia.iaName,getTrad('newgame.page6.aipresentation2',player)));
				let housemates = getHousemateId('all');
				for(let housemateId of housemates){
					let housemate = getCharacter(housemateId);
					let prez = housemate.previousProfile[0].testimonial;
					prez = prez.replace('</p>','<br>').replace('<p>','');
					presentationAll.push(discuss(housemate.pict,housemate.getName(),prez));
				}
				presentationAll.push('<div class="justifyContent">'+getTrad('newgame.page6.line3')+'</div>');
				if(player.wasMan){
					presentationAll.push(discuss(player.pict,player.getName(),getTrad('newgame.page6.prezplayerm',player)));
					presentationAll.push(discuss(pickRandom(clone(window.database.ia.laughing)),window.database.ia.iaName,getTrad('newgame.page6.aipresentation3m',player)));
					presentationAll.push(discuss(player.pict,player.getName(),getTrad('newgame.page6.prezplayer2m',player)));
				}else{
					presentationAll.push(discuss(player.pict,player.getName(),getTrad('newgame.page6.prezplayerw',player)));
				}

				getId('villaPresentationAll').innerHTML = presentationAll.join('');


				break;
		}

		if(errors.length > 0){
			getId(previousPage).querySelector('.newgameError').innerHTML = errors.join('<br>');
			toggleClass(getId(currentPage),'hide');
			toggleClass(getId(previousPage),'hide');
		}
	}

	function initNewGame(){
		//Set the difficulty
		let difficultyChoosed = getId('difficultyField').querySelector('.selected');
		if(difficultyChoosed == null)
			difficultyChoosed = getId('difficultyField').querySelector('.highlight');
		difficultyChoosed = difficultyChoosed.getAttribute('data-id');
		setStorage('difficulty',difficultyChoosed);
		deleteStorage('characters');

		//Create the Player
		let perksChoosed = [];
		let checkboxPerks = getId('perksField').querySelectorAll('.selected');
		for(let elem of checkboxPerks){
			perksChoosed.push(elem.getAttribute('data-id'));
		}
		let params = {
			'idChar':'player',
			'gender':(getId('genderField').querySelector('.selected') !== null ? getId('genderField').querySelector('.selected').getAttribute('data-id') : getId('genderField').querySelector('.highlight').getAttribute('data-id')),
			'hairColor':(getId('haircolorField').querySelector('.selected') !== null ? getId('haircolorField').querySelector('.selected').getAttribute('data-id') : getId('haircolorField').querySelector('.highlight').getAttribute('data-id')),
			'firstname':getId('firstnameField').value,
			'lastname':getId('lastnameField').value,
			'perks':perksChoosed,
			'archetype':getId('slidersFace').querySelector('.selected').getAttribute('data-id')
		};
		let player = new Character(params);

		//Create Housemates
		findHousemates();		//Create Char , Behavior, etc...
		defineSchedule();
		for(let charId of getHousemateId('all')){
			getCharacter(charId).saveProfile();
		}

		//Finish Player
		player = getCharacter('player');
		player.finishSetUp();

		//Assign Bedrooms
		let bedroomsPicts = window.database.bedrooms;
		let characters = getStorage('characters');
		let listCharId = Object.keys(characters);
		let bedPictKept = pickRandom(bedroomsPicts,listCharId.length);
		for(let i in bedPictKept){
			let character = getCharacter(listCharId[i]);
			character.set('bedroom',bedPictKept[i]);
		}

		//Choose the Villa
		buildVilla();

		//Set up the Start Cooldown of Events
		let eventsCooldown = {};
		for(let eventId in window.database.events){
			let event = window.database.events[eventId];
			if(event.startingcooldown !== undefined && event.startingcooldown > 0)
				eventsCooldown[eventId] = event.startingcooldown;
		}
		setStorage('eventsCooldown',eventsCooldown);
	}

	function buildVilla(){
		let dataVillas = window.database.villa;
		let villaId = pickRandom(Object.keys(dataVillas));

		//Define Bedrooms
		let bedrooms = {};
		let housemates = Object.keys(getStorage('characters'));
		let imgBedrooms = pickRandom(window.database.bedrooms,housemates.length);
		for(let i in housemates){
			let housemateId = housemates[i];
			bedrooms[housemateId] = {
				'owner':housemateId,
				'pict':imgBedrooms[i],
				'type':'bedroom',
				'activities':window.database.locations.bedroom.activities
			};
		}

		//Define Locations
		let locations = {};
		let locationsAvailable = window.database.locations;
		for(let locaId in locationsAvailable){

			if(locaId == 'bedroom')
				continue;

			let picts = dataVillas[villaId].locationsPics[locaId];
			locations[locaId] = {
				'pict':pickRandom(picts),
				'type':locaId,
				'activities':locationsAvailable[locaId].activities
			};
		}

		let villa = {
			'version':window.database.version,
			'id':villaId,
			'hallway':pickRandom(window.database.hallways),
			'pool':pickRandom(dataVillas[villaId].locationsPics.pool),
			'scientistSet':pickRandom(Object.keys(window.database.events.scientist.picts)),
			'accountantSet':pickRandom(Object.keys(window.database.events.accountant.picts)),
			'fleshgoddessSet':pickRandom(Object.keys(window.database.fleshrealmData.goddessSet)),
			'naturegoddessSet':pickRandom(Object.keys(window.database.naturerealmData.goddessSet)),
			'advertsPict':dataVillas[villaId].advertsPict,
			'bedrooms':bedrooms,
			'locations':locations
		};
		setStorage('villa',villa);
	}

	function defineSchedule(){					//Assign the activity of HouseMate
		let housematesId = getHousemateId();
		let actionsList = clone(window.database.actions);
		let actionsListId = Object.keys(actionsList);
		actionsListId = arrayShuffle(actionsListId);					//Random the order
		let actionNotNight = window.database.actionNotNight;
		let difficultyInfo = window.database.difficulty[getStorage('difficulty')];

		let dayTime = getDayTimeList();
		let mainIteration = 0;

		let notOk = true;
		while(mainIteration < 10 && notOk){								//If one time fail try again
			let housemateActivity = {};
			let actionUsed = [];
			notOk = false;
			for(let timeId in dayTime){										//Process dayTime

				//Pick randomly the actions
				let actionAvailable = [];
				let activityUsed = [];
				let roomUsed = [];
				actionsListId = arrayDiff(actionsListId,actionUsed);		//Don't reuse action
				for(let actionId of actionsListId){
					if(timeId == 'night' && actionNotNight.indexOf(actionId) !== -1)
						continue;
					if(activityUsed.indexOf(actionsList[actionId].activity) !== -1)
						continue;
					if(roomUsed.indexOf(actionsList[actionId].location) !== -1)		//Not in the same room
						continue;

					roomUsed.push(actionsList[actionId].location);
					activityUsed.push(actionsList[actionId].activity);
					actionAvailable.push(actionId);
				}

				let houseCanPick = {};
				let houseCanPickNumber = {};
				for(let charId of housematesId){
					if(housemateActivity[charId] === undefined)
						housemateActivity[charId] = {};
					if(houseCanPick[charId] === undefined){
						houseCanPick[charId] = [];
						houseCanPickNumber[charId] = 0;
					}

					let actionToPick = arrayShuffle(actionAvailable);
					for(let actionId of actionToPick){
						let activityId = actionsList[actionId].activity;
						if(housemateActivity[charId][activityId] !== undefined)	//If already doing that activity previously => Skip
							continue;
						houseCanPick[charId].push(actionId);
						houseCanPickNumber[charId]++;
					}
				}

				let assoc = {};
				let iteration = 0;
				while(iteration < 10 && Object.keys(assoc).length < (window.database.creation.nbParticipants - 1)){	//Fleme to fix the issue
					assoc = {};
					let sortHouseId = arrayAssocSort(houseCanPickNumber);
					for(let charId of sortHouseId){
						let newAvail = arrayDiff(houseCanPick[charId],actionUsed);
						if(newAvail.length > 0){
							let actionId = pickRandom(newAvail);
							let activityId = actionsList[actionId].activity;
							housemateActivity[charId][activityId] = true;
							getCharacter(charId).addSchedule(timeId,actionId);
							assoc[charId] = actionId;
							actionAvailable.splice(actionAvailable.indexOf(actionId),1);
							actionUsed.push(actionId);
						}
					}
					iteration++;
				}
				console.log(timeId+' it: '+iteration+' Schedule:',assoc);
				mainIteration++;
				if(iteration >= 10)
					notOk = true;
			}
		}
	}
	function findHousemates(){
		let player = getCharacter('player');
		let participants = window.database.participants;
		let nbParticipants = window.database.creation.nbParticipants-1;

		//Archetype
			let archetypeAvailables = archetypeDispo();
			let archetypeHousemates = {};
			for(let participantId in participants){
				let participant = participants[participantId];

				if(archetypeAvailables.indexOf(participantId) === -1)
					continue;

				//Dont use the player archetype
				if(player.get('archetype') == participantId)
					continue;

				let key = participant.hairColor+'_'+participant.typeBody;
				if(archetypeHousemates[key] === undefined)
					archetypeHousemates[key] = [];

				archetypeHousemates[key].push(participantId);
			}

			let archetypeChoosed = [];
			let keysPicked = pickRandom(Object.keys(archetypeHousemates),nbParticipants);
			for(let key of keysPicked){
				archetypeChoosed.push(pickRandom(archetypeHousemates[key]));
			}

		//Behavior
			let behaviorsData = window.database.behaviors;
			let listBehaviorId = Object.keys(behaviorsData);
			let findDefault = listBehaviorId.indexOf('default');
			if(findDefault !== -1)
				listBehaviorId.splice(findDefault,1);

			//Sort by Hypno type
			let sortedBehavior = {};
			for(let behaviorId of listBehaviorId){
				let info = behaviorsData[behaviorId];
				if(sortedBehavior[info.hypno] === undefined)
					sortedBehavior[info.hypno] = [];
				sortedBehavior[info.hypno].push(behaviorId);
			}
			let behaviorsKept = [];
			//Pick at least one of each
			for(let hypnoType in sortedBehavior){
				behaviorsKept.push(pickRandom(sortedBehavior[hypnoType]));
			}
			//Pick the rest randomly
			if(nbParticipants > behaviorsKept.length){
				listBehaviorId = arrayDiff(listBehaviorId,behaviorsKept);
				behaviorsKept = [...behaviorsKept,...pickRandom(listBehaviorId,(nbParticipants-3))];
			}

		for(let i in archetypeChoosed){
			let archId = archetypeChoosed[i];
			let params = {
				'idChar':archId,
				'behavior':behaviorsKept[i],
				'archetype':archId
			};
			new Character(params);
		}
	}

	function startGamePage(){

		setStorage('timeDay','morning');
		setStorage('currentLocation','bedroom.player');

		continueGame();
	}

/********** GAME LOOPS *******/
	//Give the report for the star of new day
	function getReportOfTheDay(){
		let content = [];

		//Get Housemate status

		//Get Player Status

		//Get Malus

		return content;
	}
	//Give all the location available with who inside
	function retrieveLocations(subPlace = null){
		let villaData = getStorage('villa');
		let player = getCharacter('player');
		let content = [];

		let html = '';

		if(subPlace !== null){
			if(subPlace == 'bedrooms'){
				html = '<div class="locationShow">';
				for(let locationId in villaData.bedrooms){
					let infoLocation = getLocationInfo('bedroom.'+locationId);
					if(infoLocation !== undefined){

						let peopleFace = []; let addFaces = '';
						let peopleName = []; let titleFace = '';
						if(infoLocation.people.length > 0){
							for(let info of infoLocation.people){
								peopleFace.push('<img src="'+info.pict+'">');
								peopleName.push(info.name);
							}
							addFaces = '<div class="locationFace">'+peopleFace.join('')+'</div>';
							titleFace = (peopleName.length > 1?peopleName.join(', ')+' '+getTrad('basic.arehere'):peopleName.join(', ')+' '+getTrad('basic.ishere'));
						}

						let trad = (locationId == 'player' ? 'locations.bedroomplayer.title' : 'locations.bedroom.title');
						html += '<div class="locationDisplay locationBtn" title="'+titleFace+'" data-location="bedroom.'+locationId+'">'+
										'<span class="mainLocationPicture"><img src="'+infoLocation.pict+'"></span>'+
										'<div class="locationName">'+getTrad(trad,getCharacter(locationId))+'</div>'+
										addFaces+
								'</div>';
					}
				}
				html += '</div>';
				content.push(html);
			}
		}else{
			//BedRooms
			let bedrooms = [];
			let nbBed = Object.keys(villaData.bedrooms).length;
			for(let bedroomId in villaData.bedrooms){
				bedrooms.push('<img src="'+villaData.bedrooms[bedroomId].pict+'">');
			}
			content.push('<div class="locationDisplay bedroomPictures locationBtn" data-location="bedrooms"><span class="mainLocationPicture nbBed-'+nbBed+'">'+bedrooms.join('')+'</span><div class="locationName">'+getTrad('basic.bedrooms')+'</div></div><br>');

			//Locations
			html = '<div class="locationShow">';
			for(let locationId in villaData.locations){

				//Walking in the villa
				if(locationId == 'cameraroom'){
					let inHallwayData = window.database.participants[player.get('archetype')].inHallway;
					if(inHallwayData !== undefined){
						let pickHallwaySet = player.get('pickHallwaySet');
						if(pickHallwaySet !== undefined){
							let pictHallway = inHallwayData[pickHallwaySet][player.get('slutState')];
							if(pictHallway !== undefined){
								html += '<div class="locationDisplayPlayer">'+
									'<div class="centerContent">'+imgVideo(pictHallway)+'</div>'+
									'<div class="centerContent">'+getTrad('inhallway.'+player.get('slutState'))+'</div>'+
								'</div>';
							}
						}
					}
				}

				let infoLocation = getLocationInfo(locationId);
				if(infoLocation !== undefined){

					let peopleFace = []; let addFaces = '';
					let peopleName = []; let titleFace = '';
					if(infoLocation.people.length > 0){
						for(let info of infoLocation.people){
							peopleFace.push('<img src="'+info.pict+'">');
							peopleName.push(info.name);
						}
						addFaces = '<div class="locationFace">'+peopleFace.join('')+'</div>';
						titleFace = (peopleName.length > 1?peopleName.join(', ')+' '+getTrad('basic.arehere'):peopleName.join(', ')+' '+getTrad('basic.ishere'));
					}

					if(locationId == 'cameraroom'){

						let disabled = '';
						if(locationId == 'cameraroom' && player.get('cameraUsed')){
							disabled = 'disabled="disabled"';
						}

						html += '<div class="locationDisplay activityBtn" title="'+titleFace+'" '+disabled+' data-activity="'+locationId+'">'+
									'<span class="mainLocationPicture"><img src="'+infoLocation.pict+'"></span>'+
									'<div class="locationName">'+getTrad('locations.'+locationId+'.title')+'</div>'+
									addFaces+
								'</div>';
					}else{
						html += '<div class="locationDisplay locationBtn" title="'+titleFace+'" data-location="'+locationId+'">'+
									'<span class="mainLocationPicture"><img src="'+infoLocation.pict+'"></span>'+
									'<div class="locationName">'+getTrad('locations.'+locationId+'.title')+'</div>'+
									addFaces+
								'</div>';
					}
				}
			}
			html += '</div>';
			content.push(html);		
		}

		return content;
	}
	//Give if housemate are at the location for this time
	function retrivePeopleAround(location){
		let timeDay = getStorage('timeDay');

		let peopleLocation = [];
		let housematesId = getHousemateId();
		for(let charId of housematesId){
			let charInfo = getCharacter(charId);
			if(charInfo.get('schedule')[timeDay] !== undefined){
				let locaPeople = charInfo.get('schedule')[timeDay].location;
				if(locaPeople == 'bedroom')
					locaPeople = 'bedroom.'+charId;
				if(location == locaPeople)
					peopleLocation.push({"id":charId,"name":charInfo.get('firstname'),"pict":charInfo.get('pict')});
			}
		}

		return peopleLocation;
	}
	//Give the actions available at the current location for this time
	function retrieveActions(){
		let timeDay = getStorage('timeDay');
		let currentLocation = getStorage('currentLocation');
		let infoLocation = getLocationInfo(currentLocation);
		let player = getCharacter('player');

		let content = [];

		//Navigate into activities
		let activityParams = getStorage('activityChoosed');
		if(activityParams !== false && (activityParams.action === undefined||activityParams.action === null)){
			let activityInfo = infoLocation.activities[activityParams.id];
			let activities = Object.keys(infoLocation.activities);

			//We don't want be able to read outside our own bedroom
			if(infoLocation.type != 'bedroom'||infoLocation.owner === 'player')
				content.push('<li class="actionBtn useBtn" data-action="'+activityParams.id+'"><img src="'+activityInfo.iconAction+'"><span>'+getTrad('activity.'+activityParams.id+'.action')+'</span></li>');

			//If nobody display objects AND we don't want to trap our own bedroom
			if(infoLocation.type != 'bedroom'||infoLocation.owner !== 'player'){
				let actions = clone(window.database.actions);
				for(let actionId in actions){
					let action = actions[actionId];
					if(currentLocation.indexOf(action.location) == -1)
						continue;
					if(activityParams.id != action.activity)
						continue;
					if(action.type != 'inventory' || player.inventory[actionId] === undefined){
						let pictObject = (action.pict !== undefined ? action.pict : action.pictbase);
						content.push('<li class="actionBtn useBtn" data-action="'+actionId+'"><img src="'+pictObject+'"><span>'+getTrad('actions.'+actionId+'.btn')+'</span></li>');
					}else if(player.inventory[actionId] !== undefined && player.inventory[actionId].modified == true){
						content.push('<li class="actionBtn useBtn" data-action="'+actionId+'"><img src="'+action.pictmod+'"><span>'+getTrad('actions.putback',{'object':getTrad('actions.'+actionId+'.name')})+'</span></li>');
					}
				}
			}

		//Show activities
		}else if(infoLocation.activities !== undefined){
			let activitiesAvailable = Object.keys(infoLocation.activities);
			if(activitiesAvailable.length > 0){
				let activitiesUsed = [];
				if(infoLocation.people !== undefined && infoLocation.people.length > 0){
					for(let peopleInfo of infoLocation.people){
						let character = getCharacter(peopleInfo.id);
						let activityHere = character.getCurrentActivity();
						content.push('<li class="actionBtn useBtn" data-action="'+activityHere+'" data-people="'+peopleInfo.id+'"><img src="'+peopleInfo.pict+'"><span>'+getTrad('activity.'+activityHere+'.used', character)+'</span></li>');
						activitiesUsed.push(activityHere);
					}
				}
				let activityRemaining = arrayDiff(Object.keys(infoLocation.activities),activitiesUsed);
				for(let activityId of activityRemaining){
					let activityInfo = infoLocation.activities[activityId];
					content.push('<li class="activityBtn useBtn" data-activity="'+activityId+'"><img src="'+activityInfo.icon+'"><span>'+getTrad('activity.'+activityId+'.base')+'</span></li>');
				}
			}
		}

		if(content.length > 0){
			content = ['<ul class="actionDisplay">'+content.join('')+'</ul>'];
		}

		return content;
	}


	function useNav(params){
		if(params.type == 'action'){
			setStorage('actionChoosed',params);
		}else if(params.type == 'activity'){
			setStorage('activityChoosed',params);
		}else if(params.type == 'navigation'){
			setStorage('navigationChoosed',params);
		}else if(params.type == 'event'){
			setStorage('eventChoosed',params.id);
		}

		try {
			getId('gameContent').querySelector('article').scrollTo(0,0);
			if(!IsTheEnd()){
				continueGame();
			}else{
				theEnding();
			}
		}catch(error){
			console.log('error2',error);
			showError(error);
			let from = getStorage('currentPage');
			showPage(from,'main-menu');
		}
	}
	function retriveLocationTitle(){
		let currentLocation = getStorage('currentLocation');
		let infoLocation = getLocationInfo(currentLocation);
		let titleLocation = getTrad('locations.'+infoLocation.type+'.title');
		if(infoLocation.type == 'bedroom'){
			if(infoLocation.owner !== 'player'){
				titleLocation = getTrad('locations.'+infoLocation.type+'.title',getCharacter(infoLocation.owner));
			}else{
				titleLocation = getTrad('locations.bedroomplayer.title');
			}
		}
		return '<h1>'+titleLocation+'</h1>';
	}
	function retrieveContent(){
		let currentLocation = getStorage('currentLocation');
		let villaData = getStorage('villa');
		let infoLocation = getLocationInfo(currentLocation);
		
		let timeDay = getStorage('timeDay');
		let dayTime = Object.keys(getDayTimeList());

		let html = [];
		if(infoLocation !== undefined){
			html.push(retriveLocationTitle());

			if(infoLocation.pict !== undefined){
				html.push('<div class="centerContent"><img src="'+infoLocation.pict+'"></div>');
			}

			if(currentLocation == 'playerBedroom'){
				if(timeDay == dayTime[0]){
					let reportDay = getReportOfTheDay();
					html = [...html,...reportDay];
				}
			}else if(currentLocation == 'bedrooms'){
				let locations = retrieveLocations(currentLocation);
				html = [...html,...locations];
			}else if(currentLocation == 'hallway'){
				let locations = retrieveLocations();
				html = [...html,...locations];
			}else{
				let actions = retrieveActions();
				html = [...html,actions];
			}
		}

		if(currentLocation != 'hallway'){
			html.push('<div class="centerContent"><a class="btn locationBtn" data-location="hallway">'+getTrad('basic.moveon')+'</a></div>');
		}

		let final = html.join('');
		setStorage('currentDisplay',final);

		return final;
	}


	function manageEvents(){
		let navigationChoosed = getStorage('navigationChoosed');
		let actionChoosed = getStorage('actionChoosed');
		let activityChoosed = getStorage('activityChoosed');
		let eventsCooldown = getStorage('eventsCooldown');
		let dayNumber = getStorage('dayNumber');
		let player = getCharacter('player');

		let settingEvents = setting('eventsDisabled');
		if(settingEvents === undefined)
			settingEvents = [];
		let actions = window.database.actions;
		let nextEvents = getStorage('nextEvents');

		let locationEvent = null;
		let actionEvent = null;
		//When moving from the hallway to another location
		if(navigationChoosed !== false){
			if(navigationChoosed.id.indexOf('bedroom.') !== -1){
				locationEvent = 'bedrooms';
			}else if(navigationChoosed.type == 'navigation' && ['bedrooms','hallway'].indexOf(navigationChoosed.id) === -1){
				locationEvent = 'hallway';
			}
		}

		//When visiting the cameraroom
		if(activityChoosed !== false && activityChoosed.id == 'cameraroom'){
			locationEvent = activityChoosed.id;
		}else if(actionChoosed !== false && actions[actionChoosed.id] === undefined && actionChoosed.people === null){ //When doing solo activity
			locationEvent = 'activities';
			actionEvent = actionChoosed.id;
		}

		let eventsAvailable = [];
		for(let eventId in window.database.events){
			let eventInfo = window.database.events[eventId];
			if(settingEvents.indexOf(eventId) !== -1)											//Disabled from the option
				continue;
			if(eventInfo.when === undefined || (eventInfo.when.indexOf(locationEvent) === -1 && (actionEvent === null || eventInfo.when.indexOf(actionEvent) === -1)))	//If not used here
				continue;
			if(eventsCooldown !== false && eventsCooldown[eventId] !== undefined && dayNumber < eventsCooldown[eventId])	//If in cooldown
				continue;
			if(eventInfo.conditions !== undefined){
				if(eventInfo.conditions.hadEvent !== undefined && eventInfo.conditions.hadEvent.length > 0){	//If you had those event before
					if(player.stats.eventOtherEncountered === undefined)
						continue;
					let eventPassed = Object.keys(player.stats.eventOtherEncountered);
					let intersect = arrayInter(eventInfo.conditions.hadEvent,eventPassed);
					if(intersect.length != eventInfo.conditions.hadEvent.length)
						continue;
				}
				if(eventInfo.conditions.notPerks !== undefined && eventInfo.conditions.notPerks.length > 0){	//Must not have those perks
					let inter = arrayInter(eventInfo.conditions.notPerks,player.get('perks'));
					if(inter.length > 0)
						continue;
				}
				if(eventInfo.conditions.somePerks !== undefined && eventInfo.conditions.somePerks.length > 0){	//Must have one of those perks
					let inter = arrayInter(eventInfo.conditions.somePerks,player.get('perks'));
					if(inter.length == 0)
						continue;
				}

				if(eventInfo.conditions.haveCheatsCurrent !== undefined && eventInfo.conditions.haveCheatsCurrent){		//Must have untreated cheat
					if(player.stats.cheatsCurrent === undefined || Object.keys(player.stats.cheatsCurrent).length == 0)
						continue;
					let haveCheat = false;
					for(let cheatId in player.stats.cheatsCurrent){
						if(player.stats.cheatsCurrent[cheatId] > 0){
							haveCheat = true;
							break;
						}
					}
					if(!haveCheat)
						continue;
				}
			}
			eventsAvailable.push(eventId);
		}

		if(eventsAvailable.length > 0){
			let eventKept = null;
			let eventInfo = null;
			eventsAvailable = arrayShuffle(eventsAvailable);	//Make sure events are not favorised by the start order
			for(let eventId of eventsAvailable){
				eventInfo = window.database.events[eventId];
				let randomTest = random(0,1000);
				let chance = Math.ceil(eventInfo.chance[getStorage('difficulty')]*10 / eventsAvailable.length);
				if(eventInfo !== undefined && randomTest < chance){
					eventKept = eventId;
					break;
				}
			}

			//To Force an event
			if(nextEvents !== false){
				eventKept = nextEvents;
				deleteStorage('nextEvents');
			}

			eventInfo = window.database.events[eventKept];	//Refresh the info
			if(eventKept !== null && eventInfo.effects !== undefined && Object.keys(eventInfo.effects).length > 0){
				for(let effectId in eventInfo.effects){
					if(effectId == 'perks' && effects[effectId].length > 0){
						player.addPerks(eventInfo.effects[effectId]);
					}else if(['bottomCloth','topCloth'].indexOf(effectId) !== -1 && eventInfo.effects[effectId]){
						player.changeCloth(effectId,eventInfo.effects[effectId]);
					}else{
						player.add(effectId,eventInfo.effects[effectId]);
					}
				}
			}

			if(eventKept !== null){
				let contentDisplay = [];
				let textBtnContinue = getTrad('basic.moveon');
				let textTemp = '';
				if(['hallway','activities'].indexOf(eventKept) !== -1){
					//Choose the housemate
					let housematesId = getHousemateId('actif');

					if(housematesId.length > 0){
						let housemateId = pickRandom(housematesId);

						let housemate = getCharacter(housemateId);
						let behaviorHere = housemate.get('behavior');
						
						let hypnoType = window.database.behaviors[behaviorHere].hypno;
						let hypnoLvl = giveHypnoLvl();

						let strengthHypno = 0;
						switch(hypnoLvl){
							case 'hard':player.beHypno(hypnoType,4);break;
							case 'standard':player.beHypno(hypnoType,3);break;
							case 'soft':player.beHypno(hypnoType,2);break;
							case 'simple':player.beHypno(hypnoType,1);break;
						}

						let displayInfo = clone(window.database.behaviors[behaviorHere].hypnoDisplay);
						if(displayInfo === undefined){					//If not specified for that behavior
							displayInfo = clone(window.database.behaviors.default.hypnoDisplay);
						}else if(Object.keys(displayInfo).length <= 2){	//If not enought variation add the default one
							displayInfo = {...displayInfo, ...clone(window.database.behaviors.default.hypnoDisplay)};
						}

						//Choose the set to play
						let setAvailable = [];
						for(let setId in displayInfo){
							if(displayInfo[setId].stage === undefined || displayInfo[setId].stage.indexOf(housemate.get('stage')) !== -1){
								setAvailable.push(setId);
							}
						}

						let setKept = pickRandom(setAvailable);

						//Determine what to play
						let stuffToPlay = ['base'];
						if(hypnoLvl == 'simple'){
							stuffToPlay.push('noHypno');
						}else{
							textBtnContinue = getTrad('basic.wakethefuckup');
							stuffToPlay.push('hypno');
							if(hypnoLvl != 'soft'){
								stuffToPlay.push('hypnoContinue');
							}
							stuffToPlay.push('hypnoFinish');
						}

						//Create Display
						let params = {'player':player,'housemate':housemate};
						contentDisplay.push('<h1>'+getTrad('hypnoTypes.title')+'</h1>');
						contentDisplay.push('<div id="eventContinue0">');
						contentDisplay.push('<div class="centerContent">'+imgVideo(housemate.giveHypnoFace())+'</div>');


						for(let blockId of stuffToPlay){
							if(blockId == 'hypnoContinue'){		//Separate start from continue
								contentDisplay.push('<div class="centerContent"><a class="btn btnChange" data-origin="eventContinue0" data-target="eventContinue">'+ucfirst(getTrad('basic.continue'))+'</a></div></div><div id="eventContinue" class="hide">');
							}
							for(let elem of displayInfo[setKept][blockId]){
								if(elem == 'hypno'){
									contentDisplay.push('<div class="centerContent">'+imgVideo(pickRandom(window.database.hypnoTypes[hypnoType].vids))+'</div>');
								}else{
									let text = elem.text.replace('TYPEHYPNO',hypnoType);
									text = getTrad(text,params);
									contentDisplay.push(giveDiscussText(elem,text,housemate));
								}
							}
						}

						let ambushHisto = clone(player.get('stats.ambush'));
						if(ambushHisto[housemateId] === undefined)
							ambushHisto[housemateId] = {};
						if(ambushHisto[housemateId][hypnoLvl] === undefined)
							ambushHisto[housemateId][hypnoLvl] = 0;
						ambushHisto[housemateId][hypnoLvl]++;
						player.set('stats.ambush',ambushHisto);
					}

					//Choose the 
				}else if(['scientist','scientistfail'].indexOf(eventKept) !== -1){
					
					let villa = getStorage('villa');
					let scientistInfo = window.database.events.scientist.picts[villa.scientistSet];
					
					contentDisplay.push('<h1>'+getTrad('events.'+eventKept+'.name')+'</h1>');
					contentDisplay.push('<div id="eventContinue0">');
					contentDisplay.push(dualPicture('hallway',scientistInfo.portrait));

					//Change the Player
					if(eventKept == 'scientist'){
						player.changeFace();
					}			
				}else if(['accountant'].indexOf(eventKept) !== -1){
					
					let villa = getStorage('villa');
					if(villa.accountantSet === undefined){
						villa.accountantSet = pickRandom(Object.keys(window.database.events.accountant.picts));
						setStorage('villa',villa);
					}
					let accountantInfo = window.database.events.accountant.picts[villa.accountantSet];
					
					contentDisplay.push('<h1>'+getTrad('events.'+eventKept+'.name')+'</h1>');
					contentDisplay.push('<div id="eventContinue0">');
					contentDisplay.push(dualPicture('hallway',accountantInfo.portrait));

					if(player.stats.cheatsCurrent !== undefined && Object.keys(player.stats.cheatsCurrent).length > 0){
						let listCheat = [];
						for(let cheatId in player.stats.cheatsCurrent){
							if(player.stats.cheatsCurrent[cheatId] > 0){
								switch(cheatId){
									case "votes":
										player.votes = 0;
										player.save();
										break;
									case "traps":
										let actions = window.database.actions;
										let locaAction = {};
										for(let id in actions){
											let action = actions[id];
											if(locaAction[action.activity] === undefined)
												locaAction[action.activity] = [];
											locaAction[action.activity].push(id);
										}
										for(let loca in villa.locations){
											for(let actiId in villa.locations[loca].activities){
												if(locaAction[actiId] !== undefined){
													for(let actionId of locaAction[actiId]){
														villa.locations[loca].activities[actiId].trap = [];
													}
												}
											}
										}
										for(let loca in villa.bedrooms){
											for(let actiId in villa.bedrooms[loca].activities){
												if(locaAction[actiId] !== undefined){
													for(let actionId of locaAction[actiId]){
														villa.bedrooms[loca].activities[actiId].trap = [];
													}
												}
											}
										}
										setStorage('villa',villa);
										break;
								}
								delete player.stats.cheatsCurrent[cheatId];
								listCheat.push(getTrad('events.accountant.parts.'+cheatId));
							}
						}
						textTemp = '<ul><li>'+listCheat.join('</li><li>')+'</li></ul>';
					}					
				}else if(eventKept == 'fanboy'){
					//TODO
				}else{
					contentDisplay.push('<h1>'+getTrad('events.'+eventKept+'.name')+'</h1>');
					contentDisplay.push('<div id="eventContinue0">');
				}

				//Display if there are some
					let eventsHisto = clone(player.get('stats.eventOtherEncountered'));
					let contentToDisplay = null;
					if(eventsHisto[eventKept] === undefined)
						eventsHisto[eventKept] = 0;
					if((eventsHisto[eventKept] === undefined || eventsHisto[eventKept] == 0) && window.database.events[eventKept].firstTime !== undefined){
						contentToDisplay = window.database.events[eventKept].firstTime;
					}else if(window.database.events[eventKept].content !== undefined){
						contentToDisplay = window.database.events[eventKept].content;
					}

					
					if(contentToDisplay !== null){
						let index = 0;
						for(let elem of contentToDisplay){
							let contentHere = null;

							//Filter media
							if(elem.sizeBoobs !== undefined && elem.sizeBoobs.indexOf(player.sizeBoobs) === -1)
								continue;

							if(elem == 'MORPH'){
								elem = {'id':elem,'class':'justifyContent'};
								contentHere = getTransfo(player.get('oldface'),player.get('pict'));
								if(player.topCloth !== undefined && player.sizeBoobs !== undefined){
									let pictsBoobsList = player.picturesTypes('topCloth');
									if(pictsBoobsList !== undefined){
										let pictBoobs = pictsBoobsList[pictsBoobsList.length -1];
										pictsBoobsList = player.picturesTypes('topCloth','oldBoobsSet');
										if(pictsBoobsList !== undefined){
											let oldBoobs = pictsBoobsList[pictsBoobsList.length -1];
											contentHere += getTransfo(oldBoobs,pictBoobs);
										}
									}
								}
							}else if(elem == 'MORPHFAIL'){
								elem = {'id':elem,'class':'justifyContent'};
								contentHere = imgVideo(player.getLastFace());
								if(player.topCloth !== undefined && player.sizeBoobs !== undefined){
									let pictsBoobsList = player.picturesTypes('topCloth');
									if(pictsBoobsList !== undefined){
										let pictBoobs = pictsBoobsList[pictsBoobsList.length -1];
										pictsBoobsList = player.picturesTypes('topCloth','oldBoobsSet');
										if(pictsBoobsList !== undefined){
											let oldBoobs = pictsBoobsList[pictsBoobsList.length -1];
											contentHere += getTransfo(oldBoobs,pictBoobs);
										}
									}
								}
							}else if(elem == 'BOTTOMCLOTHSHOW'){
								let pictBottom = player.picturesTypes('bottomCloth');
								contentHere = imgVideo(pictBottom[0]);
							}else if(elem == 'RESUMECHEATS'){
								contentHere = textTemp;
								elem = {'who':'accountant','event':eventKept};
							}else if(elem == 'ACTIONTEXT'){
								if(actionEvent !== null)
									contentHere = '<div class="centerContent">'+getTrad('activity.'+actionEvent+'.youuse')+'</div>';
								else
									contentHere = '';
							}else if(elem == 'CONTINUE'){		//Separate start from continue
								contentHere = '<div class="centercontent"><a class="btn btnChange" data-origin="eventContinue" data-target="eventContinue'+(index+1)+'">'+ucfirst(getTrad('basic.continue'))+'</a></div></div><div id="eventContinue'+(index+1)+'" class="hide">';
							}else if(elem.text !== undefined){
								contentHere = getTrad(elem.text,{'player':player});
							}else if(elem.media !== undefined){
								contentHere = elem.media;
							}else if(elem.dualPicture !== undefined){
								let firstPicto = elem.dualPicture[0];
								let secondPicto = elem.dualPicture[1];
								if(Array.isArray(firstPicto))
									firstPicto = pickRandom(firstPicto);
								if(Array.isArray(secondPicto))
									secondPicto = pickRandom(secondPicto);
								contentHere = dualPicture(firstPicto,secondPicto);
							}
							contentDisplay.push(giveDiscussText(elem,contentHere));
							index++;
						}
					}

				//Btn to go back
					let allDayTime = Object.keys(getDayTimeList());
					if(getStorage('timeDay') == allDayTime[allDayTime.length-1])
						contentDisplay.push('<div class="centerContent"><a class="btn nextDayBtn">'+getTrad('basic.gotosleep')+'</a></div>');
					else
						contentDisplay.push('<div class="centerContent"><a class="btn locationBtn" data-location="hallway">'+textBtnContinue+'</a></div>');

					contentDisplay.push('</div>');

				increaseTime();
				setStorage('eventDisplay',contentDisplay.join(''));

				eventsHisto[eventKept]++;
				player.set('stats.eventOtherEncountered',eventsHisto);
			}

			if(eventKept !== null && eventInfo !== null && eventInfo.cooldown !== undefined){
				if(eventsCooldown === false)
					eventsCooldown = {};
				eventsCooldown[eventKept] = dayNumber + eventInfo.cooldown;
				setStorage('eventsCooldown',eventsCooldown);
			}
		}
	}
	function manageAction(){
		let eventDisplay = getStorage('eventDisplay');
		if(eventDisplay !== false)
			return false;

		let contentDisplay = [];
		let changeTime = false;
		let textBtnContinue = getTrad('basic.moveon');
		let trapUsed = getStorage('trapUsed',[]);

		let allDayTime = Object.keys(getDayTimeList());
		let goToSleep = getStorage('timeDay') == allDayTime[allDayTime.length-1];

		//Camera Room
		let activityParams = getStorage('activityChoosed');
		if(activityParams !== false){
			let player = getCharacter('player');
			let currentLocation = getStorage('currentLocation');
			let infoLocation = getLocationInfo(currentLocation);
			if(activityParams.id == 'cameraroom'){
				let titleLocation = getTrad('locations.'+infoLocation.type+'.title');
				contentDisplay.push('<h1>'+titleLocation+'</h1>');
				if(player.cameraUsed){
					if(infoLocation.pict !== undefined){
						contentDisplay.push('<div class="centerContent"><img src="'+infoLocation.pict+'"></div>');
					}
					contentDisplay.push('<div class="centerContent">'+getTrad('cameraroom.cameraroomused')+'</div>');
				}else{
					contentDisplay.push('<div class="centerContent">'+getTrad('cameraroom.arrive')+'</div>');
					let photo = window.database.participants[player.archetype].camsPhoto[player.camsPhotoId][player.get('slutState')];

					//Perks
					let textPerk = null;
					if(player.havePerk('exhibitionist')){
						textPerk = getTrad('activity.cameraroom.perkexhibitionist',player);
						contentDisplay.push(getPictuHypno(photo,window.database.perks.exhibitionist.videoHypno,'videoHypnoCamera'));
					}else if(player.havePerk('naturist')){
						textPerk = getTrad('activity.cameraroom.perknaturist',player);
						contentDisplay.push(getPictuHypno(photo,window.database.perks.naturist.videoHypno,'videoHypnoCamera'));
					}else{
						contentDisplay.push('<div class="centerContent"><img src="'+photo+'"></div>');
					}


					let displayText = [];
					//Starter
					displayText.push(getTrad('activity.cameraroom.start',player));

					//Grudge
					if(getStorage('dayNumber') < 7)
						displayText.push(getTrad('activity.cameraroom.grudge',player));

					if(textPerk !== null)
						displayText.push(textPerk);

					//Find The Text
					let slugToText = 'behaviors.'+player.get('behavior')+'.cameraroom.'+player.get('slutState');
					let textToDisplay = getTrad(slugToText,player);
					if(textToDisplay == slugToText)
						textToDisplay = getTrad('behaviors.default.cameraroom.'+player.get('slutState'),player);
					displayText.push(textToDisplay);

					//Camera reaction
					displayText.push(getTrad('activity.cameraroom.reaction.'+player.get('slutState'),player));


					contentDisplay.push('<div class="justifyContent" style="width: 70%;margin: auto;">'+displayText.join('<br><br>')+'</div>');

					player.addvotes('cameraroom',activityParams.id);

					let soloHisto = clone(player.get('stats.soloActivity'));
					if(soloHisto[activityParams.id] === undefined)
						soloHisto[activityParams.id] = 0;
					soloHisto[activityParams.id]++;
					player.set('stats.soloActivity',soloHisto);

					changeTime = true;
				}
				setStorage('currentLocation','cameraroom');
			}
		}

		let actionParams = getStorage('actionChoosed');
		if(actionParams !== false){
			changeTime = true;	//Make the back button pass time

			if(actionParams.locationTrap){	//Set the trap at the right location
				setStorage('currentLocation',actionParams.locationTrap);
			}

			let player = getCharacter('player');
			let villa = getStorage('villa');
			let actions = clone(window.database.actions);
			let currentLocation = getStorage('currentLocation');
			let infoLocation = getLocationInfo(currentLocation);

			let activityId = actionParams.id;
			if(actions[actionParams.id] !== undefined)
				activityId = actions[actionParams.id].activity;
			
			//Interact with Housemate
			if(actionParams.people !== undefined && actionParams.people !== null){
				contentDisplay.push(retriveLocationTitle());

				let participant = getCharacter(actionParams.people);
				let actionId = participant.get('schedule')[getStorage('timeDay')].id;
				let haveTrap = (infoLocation.activities[activityId].trap !== undefined && infoLocation.activities[activityId].trap.indexOf(actionId) !== -1);
				if(haveTrap !== undefined && haveTrap){			//If Trap is deploy

					contentDisplay.push('<div class="centerContent">'+getTrad('activity.traphousemate.start',participant)+'</div>');
					contentDisplay.push(discuss(participant.get('pict'),participant.getName(),getTrad('activity.traphousemate.surprised',participant)));

					let hypnoPict = pickRandom(clone(window.database.participants[participant.get('archetype')].hypnoPicts));
					contentDisplay.push('<div class="centerContent">'+imgVideo(hypnoPict)+'</div>');
					contentDisplay.push('<div class="centerContent">'+getTrad('activity.traphousemate.continue',participant)+'</div>');
					contentDisplay.push('<div class="centerContent">'+imgVideo(hypnoPict)+'</div>');
					contentDisplay.push('<div class="centerContent">'+getTrad('activity.traphousemate.end',participant)+'</div>');

					if(participant.get('out')){
						contentDisplay.push('<div class="centerContent">'+getTrad('activity.traphousemate.alreadyout',participant)+'</div>');
					}

					participant.addStage();

					//Disable the used trap
					villa = getStorage('villa');
					if(currentLocation.indexOf('bedroom') !== -1){
						let tmpSplit = currentLocation.split('.');
						villa.bedrooms[tmpSplit[1]].activities[activityId].trap.splice(infoLocation.activities[activityId].trap.indexOf(actionId),1);
					}else{
						villa.locations[currentLocation].activities[activityId].trap.splice(infoLocation.activities[activityId].trap.indexOf(actionId),1);
					}
					setStorage('villa',villa);
					trapUsed.push(actionId);
					setStorage('trapUsed',trapUsed);
					player.set('stats.trapSuccess','++');

				}else{											//Normal Interaction
					let pictActi = participant.giveActivity(actionParams.id);
					if(pictActi !== false){
						contentDisplay.push('<div class="centerContent">'+imgVideo(pictActi)+'</div>');
					}else{
						contentDisplay.push('<div class="centerContent"><img src="'+participant.get('pict')+'"></div>');
					}
					let actionText = getTrad('actions.'+actionId+'.used',{'player':player,'housemate':participant});

					//Highlight the used action text
					let clueaction = setting('clueaction');
					if(clueaction !== undefined && clueaction){
						actionText = '<b class="highlightAction">'+actionText+'</b>';
					}

					//Find the text to display
						let behaviorsText = gObj(window.database,'behaviors.'+ participant.get('behavior') +'.activities.'+ actionParams.id);
						let defaultText = gObj(window.database,'behaviors.default.activities.'+ actionParams.id);
						let textFind = null;
						if(behaviorsText !== undefined && Object.keys(behaviorsText).length > 0)
							textFind = behaviorsText;
						else if(defaultText !== undefined && Object.keys(defaultText).length > 0)
							textFind = defaultText;

						if(textFind !== null){
							let typeChoice = givePartToUsed(textFind,participant,'activity');

							//Sort set to keep
							let keysChoice = Object.keys(textFind[typeChoice]);
							let baseChoice = [];		//Without conditions
							let specificChoice = [];	//With conditions(high priority)
							for(let setId of keysChoice){
								let infoChoice = textFind[typeChoice][setId];
								if(infoChoice.conditions === undefined||infoChoice.conditions.length == 0){
									baseChoice.push(setId);
								}else{
									if(checkCondition(infoChoice.conditions,{"player":"player","housemate":actionParams.people})){
										specificChoice.push(setId);
									}
								}
							}
							let keepChoice = (specificChoice.length > 0 ? specificChoice : baseChoice);
							let setChoice = pickRandom(keepChoice);
							for(let elem of textFind[typeChoice][setChoice].content){
								let contentHere = null;
								if(elem.text !== undefined)
									contentHere = getTrad(elem.text,{'player':player,'housemate':participant,'ACTION':actionText});
								else if(elem.media !== undefined)
									contentHere = elem.media;
								contentDisplay.push(giveDiscussText(elem,contentHere,participant));
							}
						}else{		//If nothing has been found
							contentDisplay.push('<div class="centerContent">'+getTrad('actions.'+actionId+'.used',{'player':player,'housemate':participant})+'</div>');
							contentDisplay.push(discuss(participant.get('pict'),participant.getName(),'PLACEHOLDER'));
						}

					player.addvotes('discuss',actionParams.id);

					let participHisto = clone(player.get('stats.participateActivity'));
					if(participHisto[actionParams.people] === undefined)
						participHisto[actionParams.people] = {};
					if(participHisto[actionParams.people][activityId] === undefined)
						participHisto[actionParams.people][activityId] = 0;
					participHisto[actionParams.people][activityId]++;
					player.set('stats.participateActivity',participHisto);
				}

			//Interact with Stuff OR Doing Activity
			}else{
				let haveTrap = false;
				if(actions[actionParams.id] === undefined)		//If doing the activity
					haveTrap = (infoLocation.activities[activityId].trap !== undefined && infoLocation.activities[activityId].trap.length > 0);
				else											//If messing with stuff
					haveTrap = (infoLocation.activities[activityId].trap !== undefined && infoLocation.activities[activityId].trap.indexOf(actionParams.id) !== -1);

				if(haveTrap !== undefined && haveTrap){			//If Trap is deploy

					contentDisplay.push(retriveLocationTitle());
					let hypnoPict = pickRandom(clone(window.database.participants[player.get('archetype')].hypnoPicts));
					contentDisplay.push('<div class="centerContent">'+imgVideo(hypnoPict)+'</div>');
					let typeHypno = pickRandom(Object.keys(window.database.hypnoTypes));	//Choose a random hypno

					let strengthHypno = random(2,3);

					contentDisplay.push('<div class="centerContent">'+getTrad('activity.trapped.start')+'</div>');
					let picts = pickRandom(clone(window.database.hypnoTypes[typeHypno].vids),strengthHypno);
					for(let pictId in picts){
						let pict = picts[pictId];
						contentDisplay.push('<div class="centerContent">'+getTrad('activity.trapped.strength_'+(parseInt(pictId)+1))+'</div>');
						contentDisplay.push('<div class="centerContent">'+imgVideo(pict)+'</div>');
					}

					player.beHypno(typeHypno,strengthHypno);
					player.set('stats.trapYourself','++');


					//Disable the used trap
					villa = getStorage('villa');
					if(currentLocation.indexOf('bedroom') !== -1){
						let tmpSplit = currentLocation.split('.');
						villa.bedrooms[tmpSplit[1]].activities[activityId].trap = [];
					}else{
						villa.locations[currentLocation].activities[activityId].trap = [];
					}
					setStorage('villa',villa);

					textBtnContinue = getTrad('basic.wakethefuckup');

				}else{
					if(actions[actionParams.id] !== undefined){	//Interact with stuff
						if(actions[actionParams.id].type == 'inventory'){	//Take or Put back Object
							contentDisplay.push(retriveLocationTitle());
							if(player.doHave(actionParams.id)){				//Put Back
								contentDisplay.push('<div class="centerContent"><img src="'+actions[actionParams.id].pictmod+'"></div>');
								contentDisplay.push('<div class="centerContent">'+getTrad('basic.placedtrap')+'</div>');
								player.removeInventory(actionParams.id);

								//Enable the trap
								villa = getStorage('villa');
								if(currentLocation.indexOf('bedroom') !== -1){
									let tmpSplit = currentLocation.split('.');
									villa.bedrooms[tmpSplit[1]].activities[activityId].trap.push(actionParams.id);
								}else{
									villa.locations[currentLocation].activities[activityId].trap.push(actionParams.id);
								}
								setStorage('villa',villa);
								player.set('stats.trapSetup','++');
							}else{											//Take
								contentDisplay.push('<div class="centerContent"><img src="'+actions[actionParams.id].pictbase+'"></div>');
								contentDisplay.push('<div class="centerContent">'+getTrad('basic.takestuff')+'</div>');
								player.addInventory(actionParams.id);
							}
						}else{												//Check Object and Modify it if available
							contentDisplay.push(retriveLocationTitle());
							contentDisplay.push('<div id="actionStart">');
							contentDisplay.push('<div class="centerContent"><img src="'+actions[actionParams.id].pict+'"></div>');
							contentDisplay.push('<div class="centerContent">'+getTrad('actions.'+actionParams.id+'.desc')+'</div>');

							if(player.doHave(actions[actionParams.id].object)){		//Modify
								let pictUsable = window.database.buyable[actions[actionParams.id].object].pict;
								contentDisplay.push('<div class="actionDoContinue useBtn" data-trapId="'+actionParams.id+'" data-location="'+currentLocation+'">'+
														imgVideo(pictUsable)+
														'<span>'+getTrad('actions.'+actionParams.id+'.action')+'</span>'+
													'</div>');

								contentDisplay.push('</div><div id="actionContinue" class="hide">');
								contentDisplay.push('<div class="centerContent"><img src="'+actions[actionParams.id].pict+'"></div>');
								contentDisplay.push('<div class="centerContent">'+getTrad('basic.placedtrap')+'</div>');
							}
							contentDisplay.push('</div>');
						}
					}else{										//Doing the Activity
						
						contentDisplay.push(retriveLocationTitle());

						//Choice of pictures for the activity
						let activityDisplaySetting = setting('activitydisplay');
						let pict = null;
						if(activityDisplaySetting == 'action'){
							let picts = infoLocation.activities[activityId].picts;
							if(picts === undefined || picts.length == 0){
								pict = player.get('pict');
							}else{
								if(picts.length > 1){
									let idpicts = Math.floor(player.giveExitation() / Math.ceil(100 / picts.length));
									pict = picts[idpicts];
								}else{
									pict = picts[0];
								}
							}
							if(pict !== null)
								contentDisplay.push('<div class="centerContent">'+imgVideo(pict)+'</div>');
						}else{
							pict = player.giveActivity(actionParams.id);
							if(pict === false){
								pict = player.get('pict');
								if(pict !== null)
									contentDisplay.push('<div class="centerContent">'+imgVideo(pict)+'</div>');
							}else{
								if(player.havePerk('exhibitionist')){
									contentDisplay.push(getPictuHypno(pict,window.database.perks.exhibitionist.videoHypno,'videoHypnoCamera','slowAnim'));
								}else if(player.havePerk('naturist')){
									contentDisplay.push(getPictuHypno(pict,window.database.perks.naturist.videoHypno,'videoHypnoCamera','slowAnim'));
								}else{
									contentDisplay.push('<div class="centerContent">'+imgVideo(pict)+'</div>');
								}
							}
						}
						
						contentDisplay.push('<div class="centerContent">'+getTrad('activity.'+actionParams.id+'.youuse')+'</div>');

						let textvote = '';
						let infoVote = player.addvotes('action',actionParams.id);
						if(!setting('showpoints')){
							if(infoVote.nbVote == 0 && infoVote.occuActivity > 0){
								textvote = getTrad('activity.voteresult.bad');
							}else if(infoVote.occuActivity > 0){
								textvote = getTrad('activity.voteresult.passable',{'nbvote':infoVote.nbVote});
							}else{
								textvote = getTrad('activity.voteresult.good',{'nbvote':infoVote.nbVote});
							}
							contentDisplay.push('<div class="centerContent">'+textvote+'</div>');
						}

						let soloHisto = clone(player.get('stats.soloActivity'));
						if(soloHisto[activityId] === undefined)
							soloHisto[activityId] = 0;
						soloHisto[activityId]++;
						player.set('stats.soloActivity',soloHisto);
					}
				}
			}
		}

		if(contentDisplay.length > 0){
			if(goToSleep)
				contentDisplay.push('<div class="centerContent"><a class="btn nextDayBtn">'+getTrad('basic.gotosleep')+'</a></div>');
			else
				contentDisplay.push('<div class="centerContent"><a class="btn locationBtn" data-location="hallway">'+textBtnContinue+'</a></div>');

			if(changeTime){
				increaseTime();
				setStorage('currentLocation','hallway');
			}
		}

		if(contentDisplay.length > 0){
			setStorage('contentDisplay',contentDisplay.join(''));
		}
	}
	function manageMoving(){
		let eventDisplay = getStorage('eventDisplay');
		if(eventDisplay !== false)
			return false;

		let nextParams = getStorage('navigationChoosed');
		if(nextParams !== false){
			setStorage('currentLocation',nextParams.id);
		}
	}

	function IsTheEnd(){
		if((getHousemateId('notout').length == 0))
			return true;
		let player = getCharacter('player');
		if(player.slut >= 100 || player.bimbo >= 100)
			return true;
		return false;
	}
	function theEnding(){

		function giveStats(){
			let player = getCharacter('player');

			let contentDisplay = [];

			let tmpFace = Object.keys(window.database.participants[player.archetype].picts);
			tmpFace = tmpFace[0];
			pictFirst = window.database.participants[player.archetype].picts[tmpFace];

			contentDisplay.push('<div id="statsContents">');

			contentDisplay.push('<div class="statsDiv statsDifficulty"><h2><u>'+getTrad('newgame.difficulty.title')+':</u> '+getTrad('newgame.difficulty.'+getStorage('difficulty'))+'</h2></div>');

			//Some Numbers
				contentDisplay.push('<div class="headStats ">'+
									'<div class="statsDiv"><u>'+getTrad('stats.nbdaypassed')+':</u> <br>'+getStorage('dayNumber')+'</div>'+
									'<div class="statsDiv"><u>'+getTrad('stats.nbloadgame')+':</u> '+player.stats.loadgame+'</div>'+
									'<div class="statsDiv"><u>'+getTrad('stats.totalvotegain')+':</u> '+player.stats.totalVoteGain+'<br><u>'+getTrad('stats.totalvotespend')+':</u> '+player.stats.totalVoteSpend+'</div>'+
								'</div>');

			//Body
				let pictsBoobsList = player.picturesTypes('topCloth');
				let pictsBottomsList = player.picturesTypes('bottomCloth');
				let bodyPart = [];
				bodyPart.push('<img src="'+player.starting.face+'">');
				bodyPart.push('<img src="'+player.starting.torsoPict+'">');
				bodyPart.push('<img src="'+player.starting.bottomPict+'">');
				contentDisplay.push('<div id="oldBody" class="bodyShow statsDiv">'+bodyPart.join('')+'</div>');

				bodyPart = [];
				bodyPart.push('<img src="'+window.database.participants[player.archetype].picts.base+'">');
				bodyPart.push('<img src="'+pictsBoobsList[pictsBoobsList.length -1]+'">');
				bodyPart.push('<img src="'+pictsBottomsList[pictsBottomsList.length -1]+'">');
				contentDisplay.push('<div id="newBody" class="bodyShow statsDiv">'+bodyPart.join('')+'</div>');

			contentDisplay.push('<div class="subStatsContents">');

			//Identity
				contentDisplay.push('<div id="oldName" class="statsDiv">'+
									'<u>'+getTrad('stats.name')+':</u> '+player.firstnameMan+' '+player.lastname+'<br>'+
									'<u>'+getTrad('stats.showname')+':</u> '+player.firstname+' '+player.lastname+
								'</div>');
				contentDisplay.push('<div id="currentName" class="statsDiv">'+
									'<u>'+getTrad('stats.oldname')+':</u> '+player.firstnameMan+' '+player.lastname+'<br>'+
									'<u>'+getTrad('stats.name')+':</u> '+player.firstname+' '+player.lastname+
								'</div>');
				contentDisplay.push('<div id="onlyName" class="statsDiv">'+
									'<u>'+getTrad('stats.name')+':</u> '+player.firstname+' '+player.lastname+
								'</div>');

				contentDisplay.push('<div id="oldGender" class="statsDiv">'+
									'<u>'+getTrad('stats.gender')+':</u> '+ucfirst(getTrad('basic.gender.man'))+'<br>'+
									'<u>'+getTrad('stats.temporarygender')+':</u> '+ucfirst(getTrad('basic.gender.woman'))+
								'</div>');
				contentDisplay.push('<div id="currentGender" class="statsDiv">'+
									'<u>'+getTrad('stats.previousgender')+':</u> '+ucfirst(getTrad('basic.gender.man'))+'<br>'+
									'<u>'+getTrad('stats.gender')+':</u> '+ucfirst(getTrad('basic.gender.woman'))+
								'</div>');
				contentDisplay.push('<div id="onlyGender" class="statsDiv">'+
									'<u>'+getTrad('stats.gender')+':</u> '+ucfirst(getTrad('basic.gender.woman'))+
								'</div>');
				if(player.age !== player.starting.age){
					contentDisplay.push('<div class="statsDiv">'+
									'<u>'+getTrad('stats.previousage')+':</u> '+player.starting.age+'<br>'+
									'<u>'+getTrad('stats.currentage')+':</u> '+player.age+
								'</div>');
				}else{
					contentDisplay.push('<div class="statsDiv">'+
										'<u>'+getTrad('stats.age')+':</u> '+player.age+
									'</div>');
				}

			//Data

				let textData = {};
				let dataToCheck = ['slut','bimbo'];
				for(let id of dataToCheck){
					let value = player.get(id);
					if(value < 25){
						textData[id] = getTrad('stats.data.'+id+'.low');
					}else if(value < 50){
						textData[id] = getTrad('stats.data.'+id+'.normal');
					}else if(value < 75){
						textData[id] = getTrad('stats.data.'+id+'.high');
					}else if(value < 90){
						textData[id] = getTrad('stats.data.'+id+'.substantial');
					}else{
						textData[id] = getTrad('stats.data.'+id+'.crazy');
					}
				}
				dataToCheck = ['slutStage','bimboStage'];
				for(let id of dataToCheck){
					let value = player.get(id);
					textData[id] = getTrad('stats.data.'+id+'.'+value);
				}

				let nbStage = Object.keys(window.database.stagePlayerThreshold).length + 1;
				contentDisplay.push('<div class="statsDiv statsBars">');
					contentDisplay.push('<h2>'+getTrad('stats.state')+':</h2>');
					contentDisplay.push('<div class="barSlut barMeter">'+
											'<div class="barText"><span class="barTextSpan">'+ucfirst(getTrad('basic.slut'))+': '+player.get('slut').toFixed(0)+'/100'+'</span></div>'+
											'<span class="barBar" style="width:'+Math.round(player.get('slut')*100/100)+'%"></span>'+
										'</div>');
					contentDisplay.push(textData.slut);
					contentDisplay.push('<div class="barSlut barMeter">'+
											'<div class="barText"><span class="barTextSpan">'+ucfirst(getTrad('basic.stage'))+': '+player.get('slutStage').toFixed(0)+'/'+nbStage+'</span></div>'+
											'<span class="barBar" style="width:'+Math.round(player.get('slutStage')*100/nbStage)+'%"></span>'+
										'</div>');
					contentDisplay.push(textData.slutStage);

					contentDisplay.push('<hr>');

					contentDisplay.push('<div class="barBimbo barMeter">'+
											'<div class="barText"><span class="barTextSpan">'+ucfirst(getTrad('basic.bimbo'))+': '+player.get('bimbo').toFixed(0)+'/100'+'</span></div>'+
											'<span class="barBar" style="width:'+Math.round(player.get('bimbo')*100/100)+'%"></span>'+
										'</div>');
					contentDisplay.push(textData.bimbo);
					contentDisplay.push('<div class="barBimbo barMeter">'+
											'<div class="barText"><span class="barTextSpan">'+ucfirst(getTrad('basic.stage'))+': '+player.get('bimboStage').toFixed(0)+'/'+nbStage+'</span></div>'+
											'<span class="barBar" style="width:'+Math.round(player.get('bimboStage')*100/nbStage)+'%"></span>'+
										'</div>');
					contentDisplay.push(textData.bimboStage);
				contentDisplay.push('</div>');

			contentDisplay.push('</div>');

			//Perks
				let perksList = [];
				let perks = player.get('perks');
				for(let perk of perks){
					let infoPerk = getTrad('perks.'+perk+'.effect');
					if(infoPerk === 'perks.'+perk+'.effect' || infoPerk === undefined)
						infoPerk = false;
					let perkPict = window.database.perks[perk].pict;
					if(window.database.perks[perk].pictman !== undefined)
						perkPict = window.database.perks[perk]['pict'+player.gender];
					perksList.push('<li>'+
								'<div class="recapPicture"><img src="'+perkPict+'"></div>'+
								'<div class="recapText">'+
									'<b>'+getTrad('perks.'+perk+'.name')+'</b>:<hr class="title">'+getTrad('perks.'+perk+'.desc')+
									(infoPerk !== false ? '<br><i>'+infoPerk+'</i>' : '')+
								'</div>'+
							'</li>');
				}
				contentDisplay.push('<div class="statsDiv"><h2>'+getTrad('stats.perks')+':</h2><ul class="recapList">'+perksList.join('')+'</ul></div>');


			//Other Numbers
				contentDisplay.push('<div class="statsDiv">'+
										'<u>'+getTrad('stats.trapsetup')+':</u> '+player.stats.trapSetup+'<br>'+
										'<u>'+getTrad('stats.trapsuccess')+':</u> '+player.stats.trapSuccess+'<br>'+
										'<u>'+getTrad('stats.trapyourself')+':</u> '+player.stats.trapYourself+
									'</div>');
				contentDisplay.push('<div class="statsDiv"><u>'+getTrad('stats.masturb')+':</u> '+player.stats.masturbated+'</div>');
				contentDisplay.push('<div class="statsDiv"><u>'+getTrad('stats.nbhousemate')+':</u> '+(getHousemateId('all').length)+'</div>');

			//AI & Housemates
				let housemates = getHousemateId('all');
				for(let houseId of housemates){
					let housemate = getCharacter(houseId);

					let contentHere = [];
					contentHere.push('<b><u>'+getTrad('stats.state')+':</u></b> '+housemate.stage+'/'+window.database.difficulty[getStorage('difficulty')].nbStage);
					if(player.stats.participateActivity[houseId] !== undefined){
						let activities = [];
						for(let actiId in player.stats.participateActivity[houseId]){
							activities.push('<li><u>'+getTrad('activity.'+actiId+'.title')+':</u> '+player.stats.participateActivity[houseId][actiId]+'</li>');
						}
						contentHere.push('<b><u>'+getTrad('stats.activities')+':</u></b><ul style="column-count: 3;">'+activities.join('')+'</ul>');
					}
					if(player.stats.ambush[houseId] !== undefined){
						let ambushes = [];
						for(let lvl of window.database.hypnoTypesLvl){
							if(player.stats.ambush[houseId][lvl] !== undefined)
								ambushes.push('<li><u>'+ucfirst(getTrad('hypnoTypes.type.'+lvl))+':</u> '+player.stats.ambush[houseId][lvl]+'</li>');
						}
						contentHere.push('<b><u>'+getTrad('stats.ambushes')+':</u></b><ul style="column-count: 2;">'+ambushes.join('')+'</ul>');
					}

					contentDisplay.push(giveDiscussText({"who":"housemate","pictType":"pict"},contentHere.join('<hr>'),housemate));
				}

				let aicontent = [];
				if(Object.keys(player.stats.aimessing).length > 0){
					let elems = [];
					for(let id in player.stats.aimessing){
						elems.push('<li><u>'+ucfirst(getTrad('basic.'+id))+':</u> '+player.stats.aimessing[id]+'</li>');
					}
					aicontent.push('<b><u>'+getTrad('stats.aimessing')+':</u></b><ul style="column-count: 2;">'+elems.join('')+'</ul>');
				}
				if(Object.keys(player.stats.dreams).length > 0){
					aicontent.push('<b><u>'+getTrad('stats.induceddreams')+':</u></b> '+Object.keys(player.stats.dreams).length);
				}

				if(aicontent.length > 0)
					contentDisplay.push(giveDiscussText({"who":"ia"},aicontent.join('<hr>')));

			//Dreams
				if(Object.keys(player.stats.dreams).length > 0){
					contentDisplay.push('<div class="statsDiv">');
						contentDisplay.push('<h2>'+getTrad('stats.dreams')+':</h2><div class="statsDreams">');
						for(let dreamId in player.stats.dreams){
							let pict = player.stats.dreams[dreamId];
							getId('storyPage').innerHTML = '<img id="getSize" src="'+pict+'">';
							let typeImg = (getId('getSize').naturalHeight > 230 ? 'dreamHigh' : 'dreamLarge');
							contentDisplay.push('<div class="dream"><img src="'+pict+'"><div class="dreamName '+typeImg+'">'+getTrad('morning.dreams.'+dreamId+'.title')+'</div></div>');
						}
					contentDisplay.push('</div></div>');
				}

			//Solo Activities
				if(Object.keys(player.stats.soloActivity).length > 0){
					let elems = [];
					for(let id in player.stats.soloActivity){
						elems.push('<li><u>'+getTrad('activity.'+id+'.title')+':</u> '+player.stats.soloActivity[id]+'</li>');
					}
					contentDisplay.push('<div class="statsDiv"><h2>'+getTrad('stats.soloactivity')+':</h2><ul style="column-count: 3;">'+elems.join('')+'</ul></div>');
				}

			//Other Events
				if(Object.keys(player.stats.eventOtherEncountered).length > 0){
					let elems = [];
					for(let id in player.stats.eventOtherEncountered){
						elems.push('<li><u>'+getTrad('events.'+id+'.name')+':</u> '+player.stats.eventOtherEncountered[id]+'</li>');
					}
					contentDisplay.push('<div class="statsDiv"><h2>'+getTrad('stats.eventencountered')+':</h2><ul style="column-count: 3;">'+elems.join('')+'</ul></div>');
				}

			//Transformated
				if(Object.keys(player.stats.archetypeUsed).length > 0){
					contentDisplay.push('<div class="statsDiv">');
						contentDisplay.push('<h2>'+getTrad('stats.appearance')+':</h2><div class="statsAppearance">');
						for(let id in player.stats.archetypeUsed){
							let name = window.database.participants[id].name;
							let pict = window.database.participants[id].picts.base;
							contentDisplay.push('<div class="appearance"><img src="'+pict+'"><div class="appearanceName"><u>'+name+':</u> '+player.stats.archetypeUsed[id]+'</div></div>');
						}
					contentDisplay.push('</div></div>');
				}

			//Items Bought
				if(Object.keys(player.stats.objectBuy).length > 0){
					contentDisplay.push('<div class="statsDiv">');
						contentDisplay.push('<h2>'+getTrad('stats.itemsbought')+':</h2><ul>');
						for(let id in player.stats.objectBuy){
							let name = getTrad('buyable.'+id+'.name');
							contentDisplay.push('<li><u>'+name+':</u> '+player.stats.objectBuy[id])+'</li>';
						}
					contentDisplay.push('</ul></div>');
				}

			//Cheats
				if(player.stats.cheats !== undefined && Object.keys(player.stats.cheats).length > 0){
					contentDisplay.push('<div class="statsDiv">');
						contentDisplay.push('<h2>'+getTrad('stats.cheatused')+':</h2><ul>');
						for(let id in player.stats.cheats){
							if(player.stats.cheats[id] <= 0)
								continue;
							let name = ucfirst(id);
							contentDisplay.push('<li><u>'+name+':</u> '+player.stats.cheats[id])+'</li>';
						}
					contentDisplay.push('</ul></div>');
				}

			contentDisplay.push('</div>');				

			return contentDisplay.join('');
		}

		function pageSwitchEnding(elem){

			let contentDisplay = [];
			contentDisplay.push('<div class="centerContent">');

			if(elem.linkBack !== undefined)
				contentDisplay.push('<a class="btn endingPageBtn" data-current="'+elem.linkFrom+'" data-to="'+elem.linkBack+'"><span class="icon icon-goback"></span>'+getTrad('main.back')+'</a>');
			if(elem.linkNext !== undefined)
				contentDisplay.push('<a class="btn endingPageBtn" data-current="'+elem.linkFrom+'" data-to="'+elem.linkNext+'">'+getTrad('main.continue')+'<span class="icon icon-goon"></span></a>');

			contentDisplay.push('</div>');

			return contentDisplay.join('');
		}

		function subContentEnding(sets){

			let contentDisplay = [];

			let pickSet = pickRandom(Object.keys(sets));
			let contents = sets[pickSet];
			for(let pageId in contents){
				if(pageId == 0)
					contentDisplay.push('<div class="page" id="endingPage'+pageId+'">');
				else
					contentDisplay.push('<div class="page hide" id="endingPage'+pageId+'">');

				for(let elem of contents[pageId]){
					let contentHere = null;
					if(elem.linkFrom !== undefined && (elem.linkNext !== undefined||elem.linkBack !== undefined) ){
						contentDisplay.push(pageSwitchEnding(elem));
						continue;
					}else if(typeof elem == 'string' && window.database.ending.assets[elem] !== undefined){
						let vidLoosingIt = pickRandom(window.database.ending.assets[elem].default.default);
						if(window.database.ending.assets[elem][player.hairColor] !== undefined && Object.keys(window.database.ending.assets[elem][player.hairColor]).length > 0){
							if(window.database.ending.assets[elem][player.hairColor].default !== undefined && window.database.ending.assets[elem][player.hairColor].default.length > 0)
								vidLoosingIt = pickRandom(window.database.ending.assets[elem][player.hairColor].default);
							if(window.database.ending.assets[elem][player.hairColor][player.sizeboobs] !== undefined && window.database.ending.assets[elem][player.hairColor][player.sizeboobs].length > 0)
								vidLoosingIt = pickRandom(window.database.ending.assets[elem][player.hairColor][player.sizeboobs]);
						}
						contentDisplay.push('<div class="centerContent">'+imgVideo(vidLoosingIt)+'</div>');
						continue;
					}else if(elem == 'BEDROOMPICT'){
						let villa = getStorage('villa');
						contentDisplay.push('<div class="centerContent">'+imgVideo(villa.bedrooms.player.pict)+'</div>');
						continue;
					}else if(elem == 'TRANSFORMBACK'){

						let pictsBoobsList = player.picturesTypes('topCloth');
						let pictsBottomsList = player.picturesTypes('bottomCloth');

						let transfo = [];
						transfo.push(getTransfo(window.database.participants[player.archetype].picts.base,player.starting.face));
						transfo.push(getTransfo(pictsBoobsList[pictsBoobsList.length -1],player.starting.torsoPict));
						transfo.push(getTransfo(pictsBottomsList[pictsBottomsList.length -1],player.starting.bottomPict));

						contentDisplay.push('<div class="bodyShow">'+transfo.join('')+'</div>');

						continue;
					}else if(elem.text !== undefined)
						contentHere = getTrad(elem.text,{'player':player});
					else if(elem.media !== undefined)
						contentHere = elem.media;
					contentDisplay.push(giveDiscussText(elem,contentHere));
				}

				contentDisplay.push('</div>');
			}

			//Stats
			contentDisplay.push('<div class="page hide" id="endingStats">');
				contentDisplay.push(giveStats());

				contentDisplay.push('<div class="centerContent">');
				contentDisplay.push('<a class="btn endingPageBtn" data-current="endingPage'+(contents.length)+'" data-to="endingPage'+(contents.length-1)+'"><span class="icon icon-goback"></span>'+getTrad('main.back')+'</a>');
				contentDisplay.push('<a id="endingFinalBtn" class="btn btn-success">'+getTrad('basic.close')+'<span class="icon icon-in"></span></a>');
				contentDisplay.push('</div>');
			contentDisplay.push('</div>');

			return contentDisplay.join('');
		}

		function contentEnding(type,titleTrad){

			let contentDisplay = [];

			let partsAvailable = window.database.ending[type];
			for(let partId in partsAvailable){
				let final = partsAvailable[partId];
				if(final.conditions === undefined || final.conditions.length == 0 || checkCondition(final.conditions,{"player":"player"})){

					contentDisplay.push('<h1>'+getTrad(titleTrad)+'</h1>');
					contentDisplay.push('<div id="ending">');

						contentDisplay.push(subContentEnding(window.database.ending[type][partId].contents));

					contentDisplay.push('</div>');

					break;
				}
			}

			return contentDisplay;
		}

		let player = getCharacter('player');
		let contentDisplay = [];
		window.scrollTo(0, 0);
		if((getHousemateId('notout').length == 0)){

			contentDisplay = contentEnding('wins','ending.thatsit');

		}else{
			contentDisplay = contentEnding('looses','ending.somethinghappening');
		}

		getId('storyPage').innerHTML = contentDisplay.join('');

		//Btn swtich part Continue / Next
		let changeSteps = getId('ending').getElementsByClassName('endingPageBtn');
		changeSteps = Array.prototype.slice.call( changeSteps );
		changeSteps.forEach(function(element){
			element.onclick = function() {

				let allPages = getId('ending').getElementsByClassName('page');
				for(let page of allPages){
					addClass(page,'hide');
				}
				let idOther = this.getAttribute('data-to');
				let idCurrent = this.getAttribute('data-current');
				if(idOther != null){
					elem = getId(idOther);
					window.scrollTo(0, 0);
					removeClass(elem,'hide');
				}

				//Stats Control
				if(idOther == 'endingStats'){

					let player = getCharacter('player');

					addClass(getId('oldBody'),'hide');
					addClass(getId('newBody'),'hide');

					addClass(getId('oldName'),'hide');
					addClass(getId('currentName'),'hide');
					addClass(getId('onlyName'),'hide');

					addClass(getId('oldGender'),'hide');
					addClass(getId('currentGender'),'hide');
					addClass(getId('onlyGender'),'hide');

					if(idCurrent == 'endingPageRedBox'){
						removeClass(getId('oldBody'),'hide');
					}else{
						removeClass(getId('newBody'),'hide');
					}
					if(player.wasMan){
						if(idCurrent == 'endingPageRedBox'){
							removeClass(getId('oldName'),'hide');
							removeClass(getId('oldGender'),'hide');
						}else{
							removeClass(getId('currentName'),'hide');
							removeClass(getId('currentGender'),'hide');
						}
					}else{
						removeClass(getId('onlyName'),'hide');
						removeClass(getId('onlyGender'),'hide');
					}
				}

				window.scrollTo(0, 0);
			};
		});
		getId('endingFinalBtn').onclick = function(){
			getId('gameContent').querySelector('main').innerHTML = '';
			let from = getStorage('currentPage');
			showPage(from,'main-menu');

			clearPage();
			cleanStorage();
			manageMenu();
			window.scrollTo(0, 0);
		};

		let from = getStorage('currentPage');
		showPage(from,'storyPage');
	}
	function manageNextDay(){
		loadStateGame();

		addClass(getId('dailyDream'),'hide');
		addClass(getId('dailyFun'),'hide');
		addClass(getId('dailyRecap'),'hide');
		addClass(getId('dailyFolio'),'hide');
		addClass(getId('dailyHypno'),'hide');
		addClass(getId('dailyRecap').querySelector('.locationBtn'),'hide');
		addClass(getId('btnChangeFolio'),'hide');
		addClass(getId('btnChangeHypno'),'hide');

		getId('dailyDreamBtn').setAttribute('data-target','dailyRecap');

		let player = getCharacter('player');
		let villa = getStorage('villa');
		let nextDream = getStorage('nextDream');
		let firstPlay = false;
		let haveShuffle = false;
		let changeStage = [];
		let infoNextDay = getStorage('infoNextDay');
		let dayNumber = getStorage('dayNumber');
		let settingEvents = setting('eventsDisabled');
		let eventsCooldown = getStorage('eventsCooldown');

		if(infoNextDay === false){
			infoNextDay = {};
			firstPlay = true;
			player.set('cameraUsed',false);


			//Check Stage change
				let stagePlayerCooldown = window.database.stagePlayerCooldown;
				let stagePlayerThreshold = window.database.stagePlayerThreshold;
				
				//If the cooldown is passed
				if(player.changeStageDay == 0 || getStorage('dayNumber') - player.changeStageDay >= stagePlayerCooldown){
					let typeStage = ['bimbo','slut'];
					for(let typeId of typeStage){
						let currentStage = parseInt(player[typeId+'Stage']);
						let thresholdCurrent = stagePlayerThreshold[currentStage+1];
						if(player[typeId] >= thresholdCurrent){
							changeStage.push(typeId);
							player.changeStageDay = getStorage('dayNumber');
							player[typeId+'Stage'] = currentStage+1;
							player.save();
						}
					}
				}

			//Check change Passion
				if(changeStage.length > 0){
					for(let typeId of changeStage){
						player.changePassion();
					}
					player.save();
				}

			//Perks application
				for(let perkId of player.get('perks')){
					let perkInfo = window.database.perks[perkId];
					if(perkInfo.morningEffect !== undefined){
						for(let statId in perkInfo.morningEffect){
							player.add(statId,perkInfo.morningEffect[statId]);
						}
					}
				}

			//Event Shuffle (Give new schedule to housemates)
				if(settingEvents === undefined || settingEvents.length == 0 || settingEvents.indexOf('shuffle') === -1){
					if(eventsCooldown === false||eventsCooldown.shuffle === undefined||eventsCooldown.shuffle < dayNumber){
						let randomTest = random(0,100);
						if(randomTest < window.database.events.shuffle.chance[getStorage('difficulty')]){
							haveShuffle = true;
							defineSchedule();
							setStorage('trapUsed',[]);

							if(eventsCooldown === false)
								eventsCooldown = {};
							eventsCooldown.shuffle = dayNumber + window.database.events.shuffle.cooldown;
							setStorage('eventsCooldown',eventsCooldown);

							let eventsHisto = player.get('stats.eventOtherEncountered');
							if(eventsHisto['shuffle'] === undefined)
								eventsHisto['shuffle'] = 0;
							eventsHisto['shuffle']++;
							player.set('stats.eventOtherEncountered',eventsHisto);
						}
					}
				}
		}

		//Manage Dreams
			let dreamKept = null;
			let dreamsUsed = Object.keys(player.get('stats.dreams'));
			if(dreamsUsed === false)
				dreamsUsed = [];

			let dreamProbaBase = window.database.morning.dreamProbaBase;
			let dreamProbaIncrease = window.database.morning.dreamProbaIncrease;

			//From Option if setup
			let dreamsProba = setting('dreamsProba');
			if(dreamsProba !== undefined)
				dreamProbaBase = dreamsProba.slice(0,-1);
			let dreamsProbaIncrease = setting('dreamsProbaIncrease');
			if(dreamsProbaIncrease !== undefined)
				dreamProbaIncrease = dreamsProbaIncrease.slice(0,-1);

			let probaDream = getStorage('probaDream');
			if(probaDream === false)
				probaDream = dreamProbaBase;

			let dreamsDisabled = setting('dreamsDisabled');
			if(dreamsDisabled === undefined)
				dreamsDisabled = [];

			if(infoNextDay.dreamId !== undefined){	//If already choosed keep it
				dreamKept = infoNextDay.dreamId;
			}else{
				let allDreams = clone(window.database.morning.dreams);
				let availableDreams = [];

				loopDream:
					for(let dreamId in allDreams){
						if(dreamsUsed.indexOf(dreamId) !== -1)		//Already dreamed of
							continue;
						if(dreamsDisabled.indexOf(dreamId) !== -1)	//Disable from the options
							continue;
						let dreamInfo = allDreams[dreamId];
						if(dreamInfo.conditions !== undefined){
							if(dreamInfo.conditions.version !== undefined && ( villa.version === undefined || villa.version < dreamInfo.conditions.version ))		//If not available for that version
								continue;
							if(dreamInfo.conditions.wasMan !== undefined && !player.wasMan)
								continue;
							if(dreamInfo.conditions.bimbo !== undefined && (dreamInfo.conditions.bimbo[0] > player.get('bimbo')||dreamInfo.conditions.bimbo[1] < player.get('bimbo')))
								continue;
							if(dreamInfo.conditions.slut !== undefined && (dreamInfo.conditions.slut[0] > player.get('slut')||dreamInfo.conditions.slut[1] < player.get('slut')))
								continue;
							if(dreamInfo.conditions.dream !== undefined && dreamInfo.conditions.dream.length > 0){	//All Dream must have been used
								let inter = arrayDiff(dreamInfo.conditions.dream,dreamsUsed);
								if(inter.length > 0)
									continue;
							}
							if(dreamInfo.conditions.notdream !== undefined && dreamInfo.conditions.notdream.length > 0){	//None of those Dream must have been used
								let inter = arrayInter(dreamInfo.conditions.notdream,dreamsUsed);
								if(inter.length > 0)
									continue;
							}
							if(dreamInfo.conditions.notPerks !== undefined && dreamInfo.conditions.notPerks.length > 0){	//None of those Perks must be present
								let inter = arrayInter(dreamInfo.conditions.notPerks,player.get('perks'));
								if(inter.length > 0)
									continue;	
							}
							if(dreamInfo.conditions.items !== undefined){
								for(let itemId in dreamInfo.conditions.items){
									let haveIt = player.doHave(itemId);
									if(!haveIt || dreamInfo.conditions.items[itemId].indexOf(haveIt.stage) === -1){
										continue loopDream;
									}
								}
							}
						}
						availableDreams.push(dreamId);
					}

				if(nextDream !== undefined && nextDream !== false)
					availableDreams.push(nextDream);

				if(availableDreams.length > 0){
					let randomPick = random(0,100);

					if(nextDream !== undefined && nextDream !== false)
						randomPick = 0;

					if(randomPick < probaDream){
						dreamKept = pickRandom(availableDreams);

						if(nextDream !== undefined && nextDream !== false){
							dreamKept = nextDream;
							deleteStorage('nextDream');
						}

						setStorage('probaDream',dreamProbaBase);

						let dreamed = clone(player.get('stats.dreams'));
						//Find the first Picture
						for(let elem of clone(window.database.morning.dreams[dreamKept].content)){
							if(elem.media !== undefined){
								dreamed[dreamKept] = pickRandom(elem.media);
								break;
							}
						}
						player.set('stats.dreams',dreamed);
					}else{
						setStorage('probaDream',probaDream + dreamProbaIncrease);
					}
				}
			}
			infoNextDay.dreamId = dreamKept;


			if(dreamKept !== null){
				dreamsUsed.push(dreamKept);
				let pictDream = player.get('stats.dreams.'+dreamKept);

				let contentDisplay = [];
				let content = clone(window.database.morning.dreams[dreamKept].content);
				let index = 0;
				let firstText = true;
				let firstPicture = true;
				for(let elem of content){
					let contentHere = null;
					if(elem.media !== undefined){
						if(firstPicture){
							contentHere = pictDream;
							firstPicture = false;
						}else{
							contentHere = elem.media;
						}
					}else if(typeof elem == 'string' && elem.indexOf('FLESHGODDESSPICT') !== -1){
						let pictNumber = elem.replace('FLESHGODDESSPICT','');
						let pict = pickRandom(clone(window.database.fleshrealmData.goddessSet[getStorage('villa').fleshgoddessSet]['pict'+pictNumber]));
						contentHere = imgVideo(pict);

						let dreamed = clone(player.get('stats.dreams'));
						dreamed[dreamKept] = pict;
						player.set('stats.dreams',dreamed);
					}else if(typeof elem == 'string' && elem.indexOf('NATUREGODDESSPICT') !== -1){
						let pictNumber = elem.replace('NATUREGODDESSPICT','');
						let pict = pickRandom(clone(window.database.naturerealmData.goddessSet[getStorage('villa').naturegoddessSet]['pict'+pictNumber]));
						contentHere = imgVideo(pict);

						let dreamed = clone(player.get('stats.dreams'));
						dreamed[dreamKept] = pict;
						player.set('stats.dreams',dreamed);
					}else if(elem.text !== undefined){
						if(firstText){
							contentHere = getTrad('morning.dreams.start')+' '+getTrad(elem.text,{'player':player});
							firstText = false;
						}else{
							contentHere = getTrad(elem.text,{'player':player});
						}
					}

					contentDisplay.push(giveDiscussText(elem,contentHere));
					index++;
				}

				if(firstPlay){
					let effects = clone(window.database.morning.dreams[dreamKept].effects);
					for(let effectId in effects){
						if(effectId == 'perks' && effects[effectId].length > 0){
							player.addPerks(effects.perks);
						}else if(effectId == 'doMastu' && effects[effectId]){
							setStorage('doMastu',effects[effectId]);
							getId('dailyDreamBtn').setAttribute('data-target','dailyFun');
						}else if(['bottomCloth','topCloth'].indexOf(effectId) !== -1 && effects[effectId]){
							player.changeCloth(effectId,effects[effectId]);
							infoNextDay.changeCloth = effectId;
						}else if(effectId == 'time'){										//Advance in the day
							let dayTime = Object.keys(getDayTimeList());
							setStorage('timeDay',dayTime[parseInt(effects.time)-1]);
						}else{
							player.add(effectId,effects[effectId]);
						}
					}
				}

				if(infoNextDay.funtimeId !== undefined && infoNextDay.funtimeId !== null){
					getId('dailyDreamBtn').setAttribute('data-target','dailyFun');
				}

				getId('dailyDream').querySelector('content').innerHTML = contentDisplay.join('');
				removeClass(getId('dailyDream'),'hide');
			}else{
				removeClass(getId('dailyRecap'),'hide');
			}

		//Manage Funtime
			let funtimeId = null;
			let funType = null;
			let typeMast = window.database.morning.masturbationType[player.get('sizeBoobs')];

			//If no dream OR need to mastu(from dream) OR it's already decided not to get some
			if(infoNextDay.dreamId === null || getStorage('doMastu') || (infoNextDay.funtimeId !== undefined && infoNextDay.funtimeId !== null) ){
				if(infoNextDay.funtimeId !== undefined){	//If already choosed keep it
					funtimeId = infoNextDay.funtimeId;
					funType = infoNextDay.funType;
				}else{
					let sextoys = player.doHave('sextoys');
					if(getStorage('doMastu') !== false){
						funType = getStorage('doMastu');
						funtimeId = pickRandom(Object.keys(window.database.morning.masturbation[funType][typeMast]));
						player.set('stats.masturbated','++');
					}else if(sextoys){
						let randomPointer = 33;		//With stage 1 => 33%
						if(sextoys.stage > 1)
							randomPointer += 33;	//With stage 2 => 66%
						if(sextoys.stage > 2)
							randomPointer += 24;	//With stage 3 => 90%
						let randomPick = random(0,100);
						if(randomPick <= randomPointer){
							funType = 'dildo';
							funtimeId = pickRandom(Object.keys(window.database.morning.masturbation[funType][typeMast]));
							player.set('stats.masturbated','++');
						}
					}else{	//No dream, no toys
						let randomPick = random(0,100);
						let randomPointer = 10 - (9 - (player.slut * 0.09));	//Base 1% , at 100% slut it will be 10%
						if(randomPick <= randomPointer){
							funType = 'manual';
							funtimeId = pickRandom(Object.keys(window.database.morning.masturbation[funType][typeMast]));
							player.set('stats.masturbated','++');
						}
					}
				}
				deleteStorage('doMastu');
			}

			if(funtimeId !== null){
				if(firstPlay){
					player.add('slut',5);
					let res = player.addvotes('funtime');
					infoNextDay.funtimeVote = res.nbVote;
					infoNextDay.funType = funType;
				}

				let pictsMast = window.database.morning.masturbation[funType][typeMast][funtimeId];

				let contentDisplay = [];
				contentDisplay.push('<div class="centerContent">'+getTrad('morning.masturbation.start')+'</div>');
				contentDisplay.push('<div class="centerContent">'+imgVideo(pictsMast[0])+'</div>');
				contentDisplay.push('<div class="centerContent">'+getTrad('morning.masturbation.continue'+ucfirst(funType))+'</div>');
				contentDisplay.push('<div class="centerContent">'+imgVideo(pictsMast[1])+'</div>');
				contentDisplay.push('<div class="centerContent">'+getTrad('morning.masturbation.end')+'</div>');
				if(!setting('showpoints')){
					contentDisplay.push('<div class="centerContent">'+getTrad('morning.masturbation.viewers',{"nbvote":infoNextDay.funtimeVote})+'</div>');
				}

				getId('dailyFun').querySelector('content').innerHTML = contentDisplay.join('');

				if(infoNextDay.dreamId === null)
					removeClass(getId('dailyFun'),'hide');
				addClass(getId('dailyRecap'),'hide');
				getId('dailyDreamBtn').setAttribute('data-target','dailyFun');
			}
			infoNextDay.funtimeId = funtimeId;

		//Manage Recap
			let contentDisplay = [];
			contentDisplay.push('<div class="newdayPict"><div class="centerContent">'+imgVideo(pickRandom(clone(window.database.morning.newdayPict)))+'</div></div>');

			let html = getTrad('morning.start');
			if(player.havePerk('hairperfectionist'))
				html += getTrad('morning.hair');
			if(player.doHave('makeup'))
				html += getTrad('morning.makeup');
			html += getTrad('morning.finish')
			contentDisplay.push('<div class="justifyContent">'+html+'</div>');

			if(infoNextDay.changeCloth !== undefined){
				contentDisplay.push(discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,getTrad('morning.changeCloth.'+infoNextDay.changeCloth,player)));
				contentDisplay.push('<div class="centerContent">'+imgVideo(player.picturesTypes('bottomCloth')[0])+'</div>');
			}

			//HouseMates
				let corruptpointSetting = setting('corruptpoint');
				let textMorning = getTrad('morning.housemates.hello');
				if(infoNextDay.funtimeId !== null)
					textMorning = getTrad('morning.housemates.havingfun');
				contentDisplay.push('<hr>');
				contentDisplay.push(discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,textMorning));
				let participants = getStorage('characters');
				html = '<ul class="recapList">';
				let addVotes = 0;
				for(let participantId in participants){
					if(participantId == 'player')
						continue;
					let participant = getCharacter(participantId);
					if(participant.get('out') !== undefined && participant.get('out')){
						html += '<li><div class="recapPicture"><img src="'+participant.get('pict')+'"></div><div class="recapText warnThing">'+getTrad('morning.housemates.out',participant)+'</div></li>';
					}else{
						html += '<li><div class="recapPicture"><img src="'+participant.get('pict')+'"></div><div class="recapText">'+getTrad('morning.housemates.stage'+participant.get('stage'),participant)+'</div></li>';
					}
				}
				html += '</ul>';
				contentDisplay.push('<div class="justifyContent">'+html+'</div>');

				//Add Vote per stage
				if(corruptpointSetting === true){
					let resVote = player.addvotes('bonusStage');
					if(resVote.nbVote > 0){
						if(setting('showpoints'))
							contentDisplay.push(discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,getTrad('morning.housemates.pointawarded') ));
						else
							contentDisplay.push(discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,getTrad('morning.housemates.pointawarded2',{'nbvote':resVote.nbVote}) ));
					}
				}

				if(haveShuffle){
					contentDisplay.push(discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,getTrad('events.shuffle.text')));
				}

			//Player
				let textPlayerDoing = getTrad('morning.playerdoing');
				if(player.starting.archetype != player.archetype && player.starting.transfoMention < 2){
					let perksArch = window.database.participants[player.archetype].perks;
					if(perksArch !== undefined && perksArch.length > 0){
						let mentionId = parseInt(player.starting.transfoMention)+1;
						textPlayerDoing = getTrad('morning.transfo.mention'+mentionId)+getTrad('perks.'+perksArch[0]+'.transform.mention'+mentionId,{"typeBody":player.get('typeBody'),"hairColor":player.get('hairColor')});
						player.set('starting.transfoMention',mentionId);
					}
				}
				contentDisplay.push('<hr>');
				contentDisplay.push(discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,textPlayerDoing));

				html = '<ul class="recapList">';

				//Head
					let states = window.database.morning.states;
					let statesKept = [];
					for(let stateTypeId in states){
						let valuePlayer = Math.round(player.get(stateTypeId));
						for(let part of states[stateTypeId]){
							if(part.min <= valuePlayer && valuePlayer <= part.max){
								statesKept.push(getTrad('morning.states.'+part.id));
								break;
							}
						}
					}
					if(player.get('starting')["archetype"] != player.get('archetype')){
						//TODO add to statesKept if face change
					}
					html += '<li><div class="recapPicture"><img src="'+player.get('pict')+'"></div><div class="recapText">'+statesKept.join('<hr>')+'</div></li>';

				//Boobs
					let sizeBoobs = player.get('sizeBoobs');
					if(player.get('starting')["torsoType"] != player.get('sizeBoobs'))
						sizeBoobs += 'mod';
					let picturesBoobs = player.picturesTypes('topCloth');
					let pictureBoobs = picturesBoobs[picturesBoobs.length - 1];
					html += '<li><div class="recapPicture"><img src="'+pictureBoobs+'"></div><div class="recapText">'+getTrad('morning.boobs.'+sizeBoobs)+'</div></li>';

				//Cloth
					let bottomType = player.get('bottomType');
					let picturesBottom = player.picturesTypes('bottomCloth')
					let pictureBottom; let textHere;
					if(player.havePerk('exhibitionist')||player.havePerk('naturist')){
						pictureBottom = picturesBottom[picturesBottom.length-1];
						textHere = getTrad('morning.cloth.naked');
					}else{
						pictureBottom = picturesBottom[0];
						textHere = getTrad('morning.cloth.'+bottomType);
					}
					html += '<li><div class="recapPicture"><img src="'+pictureBottom+'"></div><div class="recapText">'+textHere+'</div></li>';

				html += '</ul>';
				contentDisplay.push('<div class="justifyContent">'+html+'</div>');

				//Craving
					let craving = window.database.needbuy;
					for(let crave of craving){

						//Find the object and look if you can buy another one
						let itemGood = true;
						for(let itemId in player.get('inventory')){
							let item = player.get('inventory')[itemId];
							if(item.stage !== undefined && item.crave == crave){
								if(item['pictStage'+(item.stage+1)] === undefined){
									itemGood = false;
								}
							}
						}

						if(itemGood && parseInt(player.get(crave)) >= window.database.difficulty[getStorage('difficulty')].craveCounter){
							let params = {"firstname":player.get('firstname'),"voteCost":window.database.difficulty[getStorage('difficulty')].price};
							contentDisplay.push(discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,getTrad('morning.needbuy.'+crave,params)));
						}
					}

				//If Stage new Profile
					if(changeStage.length > 0){
						player.saveProfile(-1);
						for(let typeChange of changeStage){
							let textChange = [getTrad('changestage.base',player), getTrad('changestage.'+typeChange,player), getTrad('changestage.final',player)].join(' ');
							contentDisplay.push(discuss(pickRandom(clone(window.database.ia.laughing)),window.database.ia.iaName,textChange));
						}
					}

				//Behavior
					html = '<hr><h2>'+getTrad('morning.behavior')+':</h2>';
					html += '<ul class="recapList">';

					let perks = player.get('perks');
					for(let perk of perks){
						let infoPerk = false;
						if(setting('perksinfluence') === true){
							infoPerk = getTrad('perks.'+perk+'.effect');
							if(infoPerk === 'perks.'+perk+'.effect' || infoPerk === undefined)
								infoPerk = false;
						}
						let perkPict = window.database.perks[perk].pict;
						if(window.database.perks[perk].pictman !== undefined)
							perkPict = window.database.perks[perk]['pict'+player.gender];
						html += '<li>'+
									'<div class="recapPicture"><img src="'+perkPict+'"></div>'+
									'<div class="recapText">'+
										'<b>'+getTrad('perks.'+perk+'.name')+'</b>:<hr class="title">'+getTrad('perks.'+perk+'.desc')+
										(infoPerk !== false ? '<br><i>'+infoPerk+'</i>' : '')+
									'</div>'+
								'</li>';
					}

					html += '</ul>';
					contentDisplay.push('<div class="justifyContent">'+html+'</div>');

			removeClass(getId('dailyRecap').querySelector('.locationBtn'),'hide');
			getId('dailyRecap').querySelector('content').innerHTML = contentDisplay.join('');

		//Other Stuff
			if(settingEvents === undefined || settingEvents.length == 0 || settingEvents.indexOf('accountantfiles') === -1){
				let infoEvent = window.database.events.accountantfiles;

				let isGood = true;
				if(infoEvent.conditions !== undefined && infoNextDay.accountantfiles === undefined){
					if(infoEvent.conditions.hadEvent !== undefined && infoEvent.conditions.hadEvent.length > 0){
						let interEvent = arrayInter(infoEvent.conditions.hadEvent,Object.keys(player.stats.eventOtherEncountered));
						if(interEvent.length != infoEvent.conditions.hadEvent.length)
							isGood = false;
					}
					if(infoEvent.conditions.unique !== undefined && infoEvent.conditions.unique && player.stats.eventOtherEncountered['accountantfiles'] !== undefined)
						isGood = false;
				}

				if(isGood){
					let randomTest = random(0,100);

					if(randomTest < window.database.events.accountantfiles.chance[getStorage('difficulty')] && (infoNextDay.accountantfiles === undefined||infoNextDay.accountantfiles)){
						let eventsHisto = player.get('stats.eventOtherEncountered');
						if(eventsHisto['accountantfiles'] === undefined)
							eventsHisto['accountantfiles'] = 0;
						eventsHisto['accountantfiles']++;
						player.set('stats.eventOtherEncountered',eventsHisto);

						contentDisplay = [];
						for(let elem of infoEvent.content){
							if(elem == 'ACCOUNTANTFILES'){
								let files = [];
								for(let file of infoEvent.picts[villa.accountantSet].folio){
									files.push('<img src="'+file+'">');
								}
								contentDisplay.push('<div class="displayFolio">'+files.join('')+'</div>');
							}else if(elem.who !== undefined){
								contentDisplay.push(giveDiscussText(elem,getTrad(elem.text)));
							}
						}

						addClass(getId('dailyRecap').querySelector('.locationBtn'),'hide');
						removeClass(getId('btnChangeFolio'),'hide');

						getId('dailyFolio').querySelector('content').innerHTML = contentDisplay.join('');
					}
					infoNextDay.accountantfiles = true;
				}else{
					infoNextDay.accountantfiles = false;
				}
			}

		//Manage Adjustments
			let hypnoChoosed = null;
			if(infoNextDay.hypnoChoosed !== undefined){	//If already choosed keep it
				hypnoChoosed = infoNextDay.hypnoChoosed;
			}else{
				let randomPointer = 25;			//Base 25% of Adjustments
				if(player.giveExitation() < 30)
					randomPointer = 40;			//If to boring 40%
				let randomPick = random(0,100);

				if(randomPick <= randomPointer){
					hypnoChoosed = pickRandom(Object.keys(window.database.hypnoTypes));

					let aiHisto = clone(player.get('stats.aimessing'));
					if(aiHisto[hypnoChoosed] === undefined)
						aiHisto[hypnoChoosed] = 0;
					aiHisto[hypnoChoosed]++;
					player.set('stats.aimessing',aiHisto);
				}
			}

			infoNextDay.hypnoChoosed = hypnoChoosed;
			if(hypnoChoosed !== null){
				if(firstPlay){
					player.beHypno(hypnoChoosed,1);
				}
				contentDisplay = [];

				let vids = pickRandom(window.database.hypnoTypes[hypnoChoosed].vids,2);
				let hypnoPict = pickRandom(clone(window.database.participants[player.get('archetype')].hypnoPicts));
				let continues = getTrads('hypnoTypes.'+hypnoChoosed+'.continue',2);

				contentDisplay.push(discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,getTrad('morning.adjustments.start',player)));
				contentDisplay.push('<div class="centerContent">'+getTrad('morning.adjustments.screen')+'</div>');
				contentDisplay.push(discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,getTrad('hypnoTypes.'+hypnoChoosed+'.morning.start')));
				contentDisplay.push('<div class="centerContent">'+imgVideo(vids[0])+'</div>');
				contentDisplay.push(discuss(hypnoPict,majText(getTrad('basic.you')),continues[0]));
				contentDisplay.push('<div class="centerContent">'+imgVideo(vids[1])+'</div>');
				contentDisplay.push(discuss(hypnoPict,majText(getTrad('basic.you')),continues[1]));
				contentDisplay.push(discuss(pickRandom(clone(window.database.ia.speaking)),window.database.ia.iaName,getTrad('hypnoTypes.'+hypnoChoosed+'.morning.end')));
				contentDisplay.push('<div class="centerContent">'+getTrad('morning.adjustments.end')+'</div>');

				if(getId('dailyFolio').querySelector('content').innerHTML !== ''){
					addClass(getId('dailyFolio').querySelector('.locationBtn'),'hide');
					removeClass(getId('dailyFolio').querySelector('.btnChange'),'hide');
				}else{
					addClass(getId('dailyRecap').querySelector('.locationBtn'),'hide');
					removeClass(getId('btnChangeHypno'),'hide');
				}
				getId('dailyHypno').querySelector('content').innerHTML = contentDisplay.join('');
			}

		console.log('infoNextDay',infoNextDay);
		setStorage('infoNextDay',infoNextDay);
		deleteStorage('playNextDay');

		menuGame();

		let from = getStorage('currentPage');
		showPage(from,'dailyPage');

		saveStateGame();
	}

	function continueGame(){
		deleteStorage('logAction');
		deleteStorage('logTime');
		getId('storyPage').innerHTML = '';
		manageEvents();
		manageAction();
		manageMoving();

		//Display Content
		let contentDisplay = false;
		contentDisplay = getStorage('eventDisplay');
		if(contentDisplay === false)
			contentDisplay = getStorage('contentDisplay');
		if(contentDisplay === false){
			contentDisplay = retrieveContent();
		}
		if(['stop','otherPage'].indexOf(contentDisplay) === -1){
			getId('main-gamewindow').querySelector('article main').innerHTML = contentDisplay;
		}
		
		//Logs
		/*let displayLogs = {"logAction":{"name":"basic.logsaction"},"logTime":{"name":"basic.logstime","only":["player"]}};
		let logsZone = getId('gameContent').querySelector('footer');
		addClass(logsZone,'hide');
		html = [];
		for(let logsId in displayLogs){
			let logs = getLogs(logsId);
			if(logs instanceof Object && Object.keys(logs).length > 0){
				html.push('<div class="logDisplay"><h3>'+getTrad(displayLogs[logsId].name)+'</h3>');
				for(let id in logs){
					if(displayLogs[logsId].only === undefined||displayLogs[logsId].only.indexOf(id) !== -1){
						if(id != 'player'){
							let char = getCharacter(id);
							html.push('<div><b>'+char.firstname+' '+char.lastname+'</b></div>');
						}else{
							html.push('<div><b>'+ucfirst(getTrad('role.player.single'))+'</b></div>');
						}
						html.push('<ul><li>'+logs[id].join('</li><li>')+'</li></ul>');
					}
				}
				html.push('</div>');
			}
		}
		if(html.length > 0){
			removeClass(logsZone,'hide');
			logsZone.innerHTML = html.join('');
		}*/
		
		//Refresh Menu & Action
		menuGame();

		clearPage();

		let from = getStorage('currentPage');
		if(from != 'main-gamewindow'){
			showPage(from,'main-gamewindow');
		}

		renderStuff();
		saveStateGame();
	}
	function showPopup(text,classChoosed,timer = null){
		removeClass(getId('popup'),'hide');
		let popup = getId('popup');
		popup.innerHTML = text;
		emptyClass(popup);
		addClass(popup,classChoosed);
		if(timer !== null){
			function closePopup(){
				addClass(getId('popup'),'hide');
			}
			setTimeout(closePopup,timer);
		}
		getId('popup').onclick = function(){
			addClass(getId('popup'),'hide');
		}
	}

	function menuGame(){

		let player = getCharacter('player');

		let btnRefreshAll = getId('btnRefreshAll');
		if(btnRefreshAll !== undefined && btnRefreshAll !== null)
			btnRefreshAll.remove();

		let timeDayDisplay = getStorage('timeDayPrevious');
		if(timeDayDisplay === false)
			timeDayDisplay = getStorage('timeDay');
		let dayTimeData = getDayTimeList();
		getId('logoTimeGame').innerHTML = '<div class="icon '+dayTimeData[timeDayDisplay]+'"></div>';
		getId('dateGame').innerHTML = ucfirst(getTrad('basic.time.'+timeDayDisplay));

		getId('dayCountGame').innerHTML = getStorage('dayNumber');
		getId('voteCountGame').innerHTML = player.get('votes');
		if(player.get('cameraUsed')){
			getId('lockCameraRoom').innerHTML = '<span class="icon icon-lock" title="'+getTrad('basic.cameraroomlocked')+'"></span>'	
		}else{
			getId('lockCameraRoom').innerHTML = '<span class="icon icon-unlock" title="'+getTrad('basic.cameraroomunlocked')+'"></span>'
		}		

		getId('nameChar').innerHTML = player.getNameDisplay();

		getId('pictFacePlayer').src = player.pict;
		getId('pictTopPlayer').src = player.giveClothImg('topCloth');
		getId('pictBottomPlayer').src = player.giveClothImg('bottomCloth');

		let seeBarStat = setting('progressnumber');
		if(seeBarStat){
			removeClass(getId('infoChar'),'hide');
			getId('slutBar').querySelector('.barTextSpan').innerHTML = ucfirst(getTrad('basic.slut'))+': '+player.get('slut').toFixed(0)+'/100';
			getId('slutBar').querySelector('.barBar').style.width = Math.round(player.get('slut')*100/100)+'%';
			getId('bimboBar').querySelector('.barTextSpan').innerHTML = ucfirst(getTrad('basic.bimbo'))+': '+player.get('bimbo').toFixed(0)+'/100';
			getId('bimboBar').querySelector('.barBar').style.width = Math.round(player.get('bimbo')*100/100)+'%';
		}else{
			addClass(getId('infoChar'),'hide');
		}

		menuBtn();
	}
	function menuBtn(){
		getId('menu-profile').onclick = function(){
			characterDetails('player');
		}
		getId('menu-characters').onclick = function(){
			characterList();
		}
		getId('menu-inventory').onclick = function(){
			showInventory();
		}
		getId('menu-mainmenu').onclick = function(){
			manageMenu();
			let from = getStorage('currentPage');
			showPage(from,'main-menu');
		}
		getId('menu-save').onclick = function(){
			savegamePage();
			let from = getStorage('currentPage');
			showPage(from,'main-savegame');
		}
		getId('menu-options').onclick = function(){
			optionPage();
		}
		getId('menu-help').onclick = function(){
			let from = getStorage('currentPage');
			showPage(from,'main-help');
		}

		//Store
		getId('menu-computer').onclick = function(){
			showStore();
		}
		let player = getCharacter('player');
		if(player.votes >= parseFloat(window.database.difficulty[getStorage('difficulty')].price)){
			addClass(getId('menu-computer').querySelector('.btn'),'btn-info');
		}else{
			removeClass(getId('menu-computer').querySelector('.btn'),'btn-info');
		}

		//Btn Change Location
		let locationBtns = document.querySelectorAll('.locationBtn:not([disabled])');
		locationBtns.forEach(function(btn){
			btn.onclick = function(e) {
				let location = this.getAttribute('data-location');
				let time = this.getAttribute('data-time');

				params = {
					'id':location,
					'time':time,
					'type':'navigation'
				};
				useNav(params);
			};
		});

		//Btn Do Activity
		let activityBtns = getId('gameContent').querySelectorAll('.activityBtn:not([disabled])');
		activityBtns.forEach(function(btn){
			btn.onclick = function(e) {
				let activity = this.getAttribute('data-activity');
				
				params = {
					'id':activity,
					'type':'activity'
				};
				useNav(params);
			};
		});

		//Btn Do Action
		let actionsBtns = getId('gameContent').querySelectorAll('.actionBtn');
		actionsBtns.forEach(function(btn){
			btn.onclick = function(e) {
				let action = this.getAttribute('data-action');
				let people = this.getAttribute('data-people');
				let trap = this.getAttribute('data-trap');
				let locationTrap = this.getAttribute('data-locationTrap');
				params = {
					'id':action,
					'people':people,
					'trap':trap,
					'locationTrap':locationTrap,
					'type':'action'
				};
				useNav(params);
			};
		});

		//Btn Action Mod Object
		let actionDoContinues = getId('gameContent').querySelectorAll('.actionDoContinue');
		if(actionDoContinues.length > 0){
			actionDoContinues.forEach(function(actionDoContinue){
				actionDoContinue.onclick = function(e){
					let currentLocation = this.getAttribute('data-location');
					let trapId = this.getAttribute('data-trapId');
					let actions = window.database.actions;
					let activityId = actions[trapId].activity;
					let player = getCharacter('player');

					//Enable the trap
					villa = getStorage('villa');
					if(currentLocation.indexOf('bedroom') !== -1){
						let tmpSplit = currentLocation.split('.');
						villa.bedrooms[tmpSplit[1]].activities[activityId].trap.push(trapId);
					}else{
						villa.locations[currentLocation].activities[activityId].trap.push(trapId);
					}
					setStorage('villa',villa);
					player.set('stats.trapSetup','++');
					player.removeInventory(actions[trapId].object);

					saveStateGame();

					addClass(getId('actionStart'),'hide');
					removeClass(getId('actionContinue'),'hide');
				};
			});
		}

		//Btn nextDayBtn
		let nextDayBtns = getId('gameContent').querySelectorAll('.nextDayBtn');
		nextDayBtns.forEach(function(btn){
			btn.onclick = function(e) {
				try {
					manageNextDay();
				}catch(error){
					console.log('error4',error);
					showError(error);
					let from = getStorage('currentPage');
					showPage(from,'main-menu');
				}
			};
		});

		//BtnChange
		let btnChanges = document.querySelectorAll('.btnChange');
		btnChanges.forEach(function(btn){
			btn.onclick = function(e) {
				let origin = this.getAttribute('data-origin');
				let target = this.getAttribute('data-target');
				addClass(getId(origin),'hide');
				removeClass(getId(target),'hide');
				window.scrollTo(0, 0);
				getId('gameContent').querySelector('article').scrollTo(0, 0);
			};
		});
	}
	function renderStuff(){

		//Wavy & Flip Effects
			for(let elem of ['wavy','flip']){
				let list = document.getElementsByTagName(elem);
				for(let elemId in list){
					let text = list[elemId].innerHTML;

					let newText = [];
					for(let i in text){
						let letter = text[i];
						if(letter == ' ')
							newText.push('&nbsp;&nbsp;');
						else
							newText.push('<span style="--i:'+i+'">'+letter+'</span>');
					}
					list[elemId].innerHTML = newText.join('');
				}
			}

		//Video Speed
			let speedvideo = setting('speedvideo');
			if(speedvideo !== undefined && speedvideo !== "1"){
				let videos = document.querySelectorAll('video');
				speedvideo = parseFloat(speedvideo);
				for(let video of videos){
					video.defaultPlaybackRate = speedvideo;
					if(video.src !== ""){
						console.log(clone(video.src),video);
						video.load();
					}
				}
			}
	}

	function clearPage(){
		let elemsToPurge = [
			'contentDisplay',
			'eventDisplay',
			'actionDisplay',
			'logsDisplay',
			'actionChoosed',
			'activityChoosed',
			'navigationChoosed',
			'eventChoosed',
			'infoNextDay',
			'timeDayPrevious',
		];
		for(let elem of elemsToPurge)
			deleteStorage(elem);

		getId('storyPage').innerHTML = '';
	}

/***************************/
/********* CONTROLS ********/
/***************************/
	var isMousedown = false;
	function moveBarValue(ev){
		changeBarValue(ev);
	}
	function changeBarValue(ev){
		if (isMousedown) {
			let elem = ev.target.closest('.bar-border');
			let elemVals = elem.getBoundingClientRect();
			let x = ev.clientX - elemVals.left;
			let xPourcent = Math.round(x * 100 / elem.offsetWidth);

			elem.getElementsByClassName('bar-content')[0].style.width = xPourcent+'%';
			elem.getElementsByClassName('bar-content')[0].innerHTML = xPourcent+'%';
		}
	}