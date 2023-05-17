import express from "express";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";

const app = express();
app.use(express.json());
const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, "db.json");

const adapter = new JSONFile(file);
const defaultData = { users: [] };
const db = new Low(adapter, defaultData);

app.post("/users/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const hashPassword = await bcrypt.hash(password, 10);
    await db.read();
    const user = {
      id: randomUUID(),
      firstName,
      lastName,
      email,
      password: hashPassword,
      role: "customer",
    };
    await db.data.users.push(user);
    await db.write();
    res.redirect("/users/login");
  } catch (error) {
    res.send(error);
  }
});

app.post("/users/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    await db.read();
    const { users } = await db.data;
    const user = users.find((user) => user.email === email);
    const checkPassword = await bcrypt.compare(password, user.password);
    if (user && checkPassword) {
      process.env.userID = user.id;
      console.log(process.env.userID);
      return res.send(user);
    } else {
      return res.send("user not found.");
    }
  } catch (error) {
    res.send(error);
  }
});

app.get("/users", async (req, res) => {
  try {
    await db.read();
    const { users } = await db.data;
    const user = await users.find((user) => user.id === process.env.userID);
    if (user.role === "admin" || user.role === "superAdmin") {
      if (req.query.role) {
        if (req.query.role === "admin") {
          const admins = await users.filter((admin) => admin.role === "admin");
          console.log(admins);
          return res.send(admins);
        } else if (req.query.role === "customer") {
          const customers = await users.filter(
            (customer) => customer.role === "customer"
          );
          return res.send(customers);
        }
      }
      return res.send(users);
    } else {
      return res.end("You are not authorized to enter here");
    }
  } catch (error) {
    res.send(error);
  }
});

app.get("/users/me", async (req, res) => {
  try {
    await db.read();
    const { users } = await db.data;
    const user = await users.find((user) => user.id === process.env.userID);
    if (user) {
      return res.send(user);
    }
  } catch (error) {
    res.send(error);
  }
});

app.patch("/users/me", async (req, res) => {
  await db.read();
  let { users } = await db.data;
  const user = await users.find((user) => user.id === process.env.userID);
  let index = users.indexOf(user);

  users[index] = {
    id: user.id,
    firstName: req.body?.firstName ? req.body.firstName : user.firstName,
    lastName: req.body?.lastName ? req.body.lastName : user.lastName,
    email: req.body?.email ? req.body.email : user.email,
    password: req.body?.password
      ? await bcrypt.hash(req.body.password, 10)
      : user.password,
    role: user.role,
  };
  await db.write();
  res.send(users);
});

app.post("/users", async (req, res) => {
  try {
    await db.read();
    let { users } = await db.data;
    const user = await users.find((user) => user.id === process.env.userID);
    if (user.role === "superAdmin") {
      const { firstName, lastName, email, password } = req.body;
      const hashPassword = await bcrypt.hash(password, 10);
      const newUser = {
        id: randomUUID(),
        firstName,
        lastName,
        email,
        password: hashPassword,
        role: "admin",
      };
      await db.data.users.push(newUser);
      await db.write();
      res.send(`Now ${firstName} is the new admin`);
    } else {
      return res.send("You are not authorized to enter here");
    }
  } catch (error) {
    res.send(error);
  }
});

app.delete("/users/:id", async (req, res) => {
  const { id } = req.params;
  await db.read();
  let { users } = await db.data;
  const user = await users.find((user) => user.id === process.env.userID);
  const userID = await users.find((user) => user.id === id);

  if (userID) {
    if (user.role === "admin" || user.role === "superAdmin") {
      if (user.role === "admin") {
        if (userID.role === "admin" || userID.role === "superAdmin") {
          return res.send("You cannot delete admin and super admins.");
        } else {
          const newData = [];
          users.forEach((item) => {
            if (item.id !== id) {
              newData.push(item);
            }
          });
          db.data.users = newData;
          await db.write();
          return res.send(`User has been removed from the server`);
        }
      }
      if (user.role === "superAdmin") {
        const newData = [];
        users.forEach((item) => {
          if (item.id !== id) {
            newData.push(item);
          }
        });
        db.data.users = newData;
        await db.write();
        return res.send(`User has been removed from the server`);
      }
    } else {
      return res.end("You are not authorized to enter here");
    }
  } else {
    return res.send("No such user exists on the server");
  }
});

app.listen(3001, () => {
  console.log("Server ishlamoqda...");
});
