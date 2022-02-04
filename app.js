const fs = require("fs");
const {Client, Intents, MessageActionRow,MessageButton,MessageEmbed,Collection} = require("discord.js");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const TicketSetupData = require("./models/ticketSetup")
const db = require("./models/ticket")
const {createTranscript} = require("discord-html-transcripts");
const client = new Client({
  fetchAllMembers: true,
  intents:[
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_BANS,
    Intents.FLAGS.GUILD_INTEGRATIONS,
    Intents.FLAGS.GUILD_VOICE_STATES,
    
  ]});
const {token,mongoDB} = require("./ayarlar.json");

const mongoose = require("mongoose");
mongoose.connect(mongoDB)
.then(() => console.log("Connect MongoDb"))
.catch(console.error);



global.client = client;
client.commands = (global.commands = []);
fs.readdir("./slashKomutlar/", (err, files) => {
    if (err) throw err;

    files.forEach((file) => {
        if (!file.endsWith(".js")) return;
        let props = require(`./slashKomutlar/${file}`);

        client.commands.push({
             name: props.name.toLowerCase(),
             description: props.description,
             options: props.options,
             category: props.category,
             
        })
        console.log(`👌 Slash Komut Yüklendi: ${props.name}`);
    });
});

fs.readdir("./events/", (_err, files) => {
    files.forEach((file) => {
        if (!file.endsWith(".js")) return;
        const event = require(`./events/${file}`);
        let eventName = file.split(".")[0];
        
        console.log(`👌 Event yüklendi: ${eventName}`);
        client.on(eventName, (...args) => {
           event(client, ...args);
        });
    });
});

client.on("ready", async () => {

    const rest = new REST({ version: "9" }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: client.commands,
    });
  } catch (error) {
    console.error(error);
  }
});


client.login(token);



client.on("interactionCreate",async interaction => {
  if(!interaction.isButton()) return
  const { guild,customId,channel,member } = interaction;
  
      
      const Data = await TicketSetupData.findOne({ GuildID: guild.id });
      if(!Data) return;
  

  if(!["close","sil","lock","unlock"].includes(customId)) return;

    if(!TicketSetupData) 
    return interaction.reply({content:`Bu sistem için veriler eski`,ephemeral:true});

    
    const Embed = new MessageEmbed().setColor("BLUE");
    
   db.findOne({ChannelID: channel.id}, async (err, docs) => {
     if(err) throw err;
     if(!docs)
     return interaction.reply({
       content:"destek talebi hakkında veri bulunamadı lütfen manuel işlem yapınız",
       ephemeral:true
     }) .catch(err => interaction.channel.send({content:`${err}`,ephemeral:true}));
     

     switch(customId){
       case "sil":
        interaction.reply({content:"Kanal siliniyor",ephemeral:false});
        await channel.delete();
         break;

         case "lock":
           if(docs.Locked == true) return interaction.reply({content:"Bu destek talebi zaten kilitli",ephemeral:true})
           .catch(err => interaction.channel.send({content:`${err}`,ephemeral:true}));

           await db.updateOne({ChannelID: channel.id}, {Locked: true})
           Embed.setDescription(`🔒 | Destek talebi kilitlendi`)
           
           docs.MembersID.forEach(async (m) => {
           channel.permissionOverwrites.edit(m, {
              SEND_MESSAGES: false,
              VIEW_CHANNEL: false,
            })
            }) 
            interaction.reply({embeds:[Embed]})
            .catch(err => interaction.channel.send({content:`${err}`,ephemeral:true}));
          break; 

          case "unlock":
            if(docs.Locked == false) return interaction.reply({content:"Bu destek talebi zaten açık",ephemeral:true})
            .catch(err => interaction.channel.send({content:`${err}`,ephemeral:true}));
            await db.updateOne({ChannelID: channel.id}, {Locked: false})
            Embed.setDescription(`🔓 | Destek talebi açıldı`)
            docs.MembersID.forEach(async (m) => {
            channel.permissionOverwrites.edit(m, {
                SEND_MESSAGES: true,
               VIEW_CHANNEL: true,
               })
             })
              interaction.reply({embeds:[Embed]})
              .catch(err => interaction.channel.send({content:`${err}`,ephemeral:true}));
          break;

          case "close":
             
             if(docs.Closed){
              await interaction.reply({
                content:"Bu destek talebi zaten kapatılmış",
                components:
                [new MessageActionRow()
                  .addComponents(
                new MessageButton()
                .setCustomId("sil")
                .setLabel("Kanalı Sil")
                .setStyle("SECONDARY")
                .setEmoji("🗑️"),
             )],ephemeral:false}).catch(err => interaction.channel.send({content:`${err}`}));
             return;
             }  
 const dosya = await createTranscript(channel, {
   limit: -1,
   returnBuffer: false,
   fileName: `${docs.TicketID}.html`,
 });
 
 await db.updateOne({ChannelID: channel.id}, {Closed: true});
 await guild.channels.cache.get(Data.Transcripts).send({
   embeds: [Embed.setTitle(`Transcripts Type: ${docs.Type}\nTicket ID: ${docs.TicketID}`)],
 files: [dosya],
 });
 interaction.reply({content:`Destek talebi Kaydedildi ve kapatıldı!\nBu kanal 5 saniye sonra silinecektir`})
 .catch(err => interaction.channel.send({content:`${err}`,ephemeral:true}));

 setTimeout(() => {
  channel.delete();
 },5000)
            break;
      }

  })
  
})