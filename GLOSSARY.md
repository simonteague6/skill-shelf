# Skill Shelf

Skill Shelf presents locally installed agent skills in project and global collections.

## Language

**Installed skill**:
A local collection containing `SKILL.md` instructions and any accompanying scripts or supporting files.

**Project scope**:
The installed skills associated with the current directory and its included ancestor directories.

**Global scope**:
The installed skills associated with the user's agent environments rather than a particular project.

**Supported location**:
A recognized project or global installation destination for an agent supported by skills.sh.

**Duplicate installation**:
An additional installation of the same skill at one directory level, either referencing the same underlying folder or containing an identical complete set of files. Installations at different project directory levels or in different scopes remain separate; installations with different content are distinct even when their names match.
